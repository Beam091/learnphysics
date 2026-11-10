// Worker ของ LearnPhysics
// ทำหน้าที่เป็นระบบหลังบ้านสำหรับทุก path ที่ขึ้นต้นด้วย /api/
//   GET  /api/health
//   GET  /api/catalog              หลักสูตร (หมวด > บท > บทเรียนที่เปิดแล้ว)
//   GET  /api/lessons/:slug        รายละเอียดบทเรียน (ไม่ส่งเฉลยไปด้วย)
//   POST /api/quizzes/:id/check    ตรวจคำตอบแบบทดสอบ (ตรวจฝั่งเซิร์ฟเวอร์)
//   GET  /api/auth/google          เริ่ม login ด้วย Google (OAuth 2.0)
//   GET  /api/auth/callback        Google ส่งผู้ใช้กลับมาที่นี่
//   POST /api/auth/logout          ออกจากระบบ
//   GET  /api/me                   ข้อมูลผู้ใช้ + ความคืบหน้า + บุ๊กมาร์ก
//   DELETE /api/me                 ลบบัญชีและข้อมูลทั้งหมด (PDPA)
//   POST /api/progress/sync        ซิงค์ความคืบหน้าขึ้นฐานข้อมูล
//   POST /api/bookmarks/toggle     เพิ่ม/ลบบุ๊กมาร์ก
//   GET|POST /api/notes/:slug      โน้ตย่อส่วนตัวของแต่ละบทเรียน

const CATALOG_SQL = `
  SELECT
    c.slug  AS category_slug,
    c.title AS category_title,
    ch.slug AS chapter_slug,
    ch.title AS chapter_title,
    ch.planned_lessons AS planned_lessons,
    (SELECT COUNT(*) FROM lessons l
      WHERE l.chapter_id = ch.id AND l.status = 'published') AS published_lessons
  FROM categories c
  JOIN chapters ch ON ch.category_id = c.id
  ORDER BY c.sort_order, ch.sort_order
`;

const PUBLISHED_LESSONS_SQL = `
  SELECT l.slug AS slug, l.title AS title, l.level AS level, ch.slug AS chapter_slug
  FROM lessons l
  JOIN chapters ch ON ch.id = l.chapter_id
  WHERE l.status = 'published'
  ORDER BY l.sort_order, l.id
`;

const json = (data, init) => Response.json(data, init);

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

// จัดแถวจากฐานข้อมูลให้เป็น หมวด > บท > บทเรียน
export function groupCatalog(rows, lessonRows = []) {
  const lessonsByChapter = new Map();
  for (const l of lessonRows) {
    if (!lessonsByChapter.has(l.chapter_slug)) lessonsByChapter.set(l.chapter_slug, []);
    lessonsByChapter.get(l.chapter_slug).push({ slug: l.slug, title: l.title, level: l.level });
  }

  const categories = [];
  const bySlug = new Map();
  for (const r of rows) {
    let cat = bySlug.get(r.category_slug);
    if (!cat) {
      cat = { slug: r.category_slug, title: r.category_title, chapters: [] };
      bySlug.set(r.category_slug, cat);
      categories.push(cat);
    }
    cat.chapters.push({
      slug: r.chapter_slug,
      title: r.chapter_title,
      plannedLessons: r.planned_lessons,
      publishedLessons: r.published_lessons,
      lessons: lessonsByChapter.get(r.chapter_slug) || [],
    });
  }
  return categories;
}

// ตรวจคำตอบข้อเดียว: choice = ตำแหน่งตัวเลือก (เริ่มที่ 0), number = ตัวเลขที่ยอมให้คลาดเคลื่อนได้
export function gradeQuestion(question, given) {
  const answer = parseJson(question.answer_json, null);
  if (answer === null) return false;
  if (question.type === "choice") {
    return Number.isInteger(given) && given === answer;
  }
  if (question.type === "number") {
    return (
      typeof given === "number" &&
      Number.isFinite(given) &&
      Math.abs(given - answer.value) <= (answer.tolerance ?? 0)
    );
  }
  return false;
}

async function getLesson(env, slug) {
  const lesson = await env.DB.prepare(
    `SELECT l.id, l.slug, l.title, l.summary, l.level,
            ch.slug AS chapter_slug, ch.title AS chapter_title, cat.title AS category_title
     FROM lessons l
     JOIN chapters ch ON ch.id = l.chapter_id
     JOIN categories cat ON cat.id = ch.category_id
     WHERE l.slug = ? AND l.status = 'published'`
  ).bind(slug).first();
  if (!lesson) return null;

  const allLessons = (await env.DB.prepare(
    `SELECT l.slug, l.title, ch.title AS chapter_title
     FROM lessons l
     JOIN chapters ch ON ch.id = l.chapter_id
     JOIN categories cat ON cat.id = ch.category_id
     WHERE l.status = 'published'
     ORDER BY cat.sort_order, ch.sort_order, l.sort_order, l.id`
  ).all()).results;
  const idx = allLessons.findIndex((x) => x.slug === lesson.slug);
  const prevLesson = idx > 0 ? { slug: allLessons[idx - 1].slug, title: allLessons[idx - 1].title, chapterTitle: allLessons[idx - 1].chapter_title } : null;
  const nextLesson = idx >= 0 && idx < allLessons.length - 1 ? { slug: allLessons[idx + 1].slug, title: allLessons[idx + 1].title, chapterTitle: allLessons[idx + 1].chapter_title } : null;

  const videos = (await env.DB.prepare(
    `SELECT provider, url, title, channel_name, channel_url
     FROM videos WHERE lesson_id = ? AND is_active = 1 ORDER BY sort_order, id`
  ).bind(lesson.id).all()).results;

  const animation = await env.DB.prepare(
    `SELECT engine, title, config_json FROM animations WHERE lesson_id = ? ORDER BY id LIMIT 1`
  ).bind(lesson.id).first();

  const game = await env.DB.prepare(
    `SELECT template, title, config_json FROM games WHERE lesson_id = ? ORDER BY id LIMIT 1`
  ).bind(lesson.id).first();

  const quiz = await env.DB.prepare(
    `SELECT id, title, pass_score FROM quizzes WHERE lesson_id = ? ORDER BY id LIMIT 1`
  ).bind(lesson.id).first();

  let quizOut = null;
  if (quiz) {
    const questions = (await env.DB.prepare(
      `SELECT id, type, body, choices_json FROM questions WHERE quiz_id = ? ORDER BY sort_order, id`
    ).bind(quiz.id).all()).results;
    quizOut = {
      id: quiz.id,
      title: quiz.title,
      passScore: quiz.pass_score,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        body: q.body,
        choices: parseJson(q.choices_json, null),
      })),
    };
  }

  return {
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    level: lesson.level,
    category: lesson.category_title,
    chapter: { slug: lesson.chapter_slug, title: lesson.chapter_title },
    prevLesson,
    nextLesson,
    videos: videos.map((v) => ({
      provider: v.provider,
      url: v.url,
      title: v.title,
      channelName: v.channel_name,
      channelUrl: v.channel_url,
    })),
    animation: animation
      ? { engine: animation.engine, title: animation.title, config: parseJson(animation.config_json, {}) }
      : null,
    game: game
      ? { template: game.template, title: game.title, config: parseJson(game.config_json, {}) }
      : null,
    quiz: quizOut,
  };
}

async function checkQuiz(env, request, quizId, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const answers = body && typeof body.answers === "object" && body.answers ? body.answers : null;
  if (!answers) return json({ ok: false, error: "bad_request" }, { status: 400 });

  if (!user) {
    user = await getSessionUser(env, request);
  }
  if (!user) {
    return json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const quiz = await env.DB.prepare(
    `SELECT z.id, z.pass_score FROM quizzes z
     JOIN lessons l ON l.id = z.lesson_id
     WHERE z.id = ? AND l.status = 'published'`
  ).bind(quizId).first();
  if (!quiz) return json({ ok: false, error: "not_found" }, { status: 404 });

  const questions = (await env.DB.prepare(
    `SELECT id, type, answer_json, explanation FROM questions WHERE quiz_id = ? ORDER BY sort_order, id`
  ).bind(quizId).all()).results;

  const results = questions.map((q) => {
    const correct = gradeQuestion(q, answers[String(q.id)]);
    const answer = parseJson(q.answer_json, null);
    return {
      id: q.id,
      correct,
      explanation: q.explanation,
      correctAnswer: q.type === "number" ? answer && answer.value : answer,
    };
  });
  const score = results.filter((r) => r.correct).length;
  const total = results.length;
  const percent = total ? Math.round((score / total) * 100) : 0;

  // ผู้เรียนล็อกอินอยู่แล้ว (ผ่านการตรวจสอบด้านบน) บันทึกประวัติการสอบและคะแนนสูงสุดลงฐานข้อมูล
  if (user) {
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO quiz_attempts (user_id, quiz_id, score, total, answers_json)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(user.id, quizId, score, total, JSON.stringify(answers)),
        env.DB.prepare(
          `INSERT INTO progress (user_id, lesson_id, video_done, anim_done, game_done, quiz_best, updated_at)
           SELECT ?, z.lesson_id, 0, 0, 0, ?, datetime('now') FROM quizzes z WHERE z.id = ?
           ON CONFLICT(user_id, lesson_id) DO UPDATE SET
             quiz_best = CASE
               WHEN progress.quiz_best IS NULL THEN excluded.quiz_best
               ELSE MAX(progress.quiz_best, excluded.quiz_best)
             END,
             updated_at = datetime('now')`
        ).bind(user.id, percent, quizId),
      ]);
    } catch (err) {
      console.error("save attempt failed", err);
    }
  }

  return json({ ok: true, score, total, percent, passed: percent >= quiz.pass_score, results }, { headers: NO_STORE });
}

// ---------------------------------------------------------------- ระบบสมาชิก (Google Login)

const SESSION_COOKIE = "lp_session";
const STATE_COOKIE = "lp_oauth_state";
const RETURN_COOKIE = "lp_return_to";
const NO_STORE = { "cache-control": "no-store" };

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookieHeader(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function safeReturnTo(value) {
  // อนุญาตเฉพาะ path ภายในเว็บเราเท่านั้น (กัน open redirect)
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return "/";
}

function redirect(location, cookies = []) {
  const headers = new Headers({ location, ...NO_STORE });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 302, headers });
}

async function getSessionUser(env, request) {
  const sid = readCookie(request, SESSION_COOKIE);
  if (!sid) return null;
  return await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.avatar_url
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).bind(sid).first();
}

function startGoogleLogin(env, url) {
  if (!env.GOOGLE_CLIENT_ID) return json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  const state = crypto.randomUUID() + crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const cookies = [cookieHeader(STATE_COOKIE, state, 600)];
  const returnTo = url.searchParams.get("return_to");
  if (returnTo) cookies.push(cookieHeader(RETURN_COOKIE, safeReturnTo(returnTo), 600));
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, cookies);
}

async function googleCallback(env, request, url) {
  const clearCookies = [cookieHeader(STATE_COOKIE, "", 0), cookieHeader(RETURN_COOKIE, "", 0)];
  const fail = (code) => redirect(`/?login_error=${code}`, clearCookies);

  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = readCookie(request, STATE_COOKIE);
  if (!code || !state || !saved || state !== saved) return fail("state");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail("config");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("token exchange failed", tokenRes.status);
    return fail("token");
  }
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return fail("token");

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return fail("userinfo");
  const info = await infoRes.json();
  if (!info.sub || !info.email) return fail("userinfo");

  await env.DB.prepare(
    `INSERT INTO users (google_sub, email, name, avatar_url, last_login_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       avatar_url = excluded.avatar_url,
       last_login_at = datetime('now')`
  ).bind(info.sub, info.email, info.name || null, info.picture || null).run();
  const user = await env.DB.prepare(`SELECT id FROM users WHERE google_sub = ?`).bind(info.sub).first();

  const sid = crypto.randomUUID() + "-" + crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND expires_at <= datetime('now')`).bind(user.id),
    env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))`).bind(sid, user.id),
  ]);

  const returnTo = safeReturnTo(readCookie(request, RETURN_COOKIE) || "/");
  return redirect(returnTo, [...clearCookies, cookieHeader(SESSION_COOKIE, sid, 2592000)]);
}

async function logout(env, request) {
  const sid = readCookie(request, SESSION_COOKIE);
  if (sid) await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sid).run();
  return json({ ok: true }, { headers: { ...NO_STORE, "set-cookie": cookieHeader(SESSION_COOKIE, "", 0) } });
}

async function loadMe(env, user) {
  const progressRows = (await env.DB.prepare(
    `SELECT l.slug, p.video_done, p.anim_done, p.game_done, p.quiz_best
     FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.user_id = ?`
  ).bind(user.id).all()).results;
  const bookmarkRows = (await env.DB.prepare(
    `SELECT l.slug FROM bookmarks b JOIN lessons l ON l.id = b.lesson_id
     WHERE b.user_id = ? ORDER BY b.created_at DESC`
  ).bind(user.id).all()).results;

  const progress = {};
  for (const r of progressRows) {
    progress[r.slug] = {
      video: !!r.video_done,
      anim: !!r.anim_done,
      game: !!r.game_done,
      quiz: r.quiz_best,
    };
  }
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatar_url },
    progress,
    bookmarks: bookmarkRows.map((r) => r.slug),
  };
}

async function deleteAccount(env, request, user) {
  // ตารางข้อมูลผู้เรียนทั้งหมดผูก ON DELETE CASCADE ไว้กับ users จึงถูกลบพร้อมกัน
  // ลบแถวลูกให้ชัดเจนด้วย เผื่อฐานข้อมูลไม่ได้เปิดใช้ foreign key
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM notes WHERE user_id = ?`).bind(user.id),
    env.DB.prepare(`DELETE FROM bookmarks WHERE user_id = ?`).bind(user.id),
    env.DB.prepare(`DELETE FROM progress WHERE user_id = ?`).bind(user.id),
    env.DB.prepare(`DELETE FROM quiz_attempts WHERE user_id = ?`).bind(user.id),
    env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user.id),
    env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id),
  ]);
  return json({ ok: true }, { headers: { ...NO_STORE, "set-cookie": cookieHeader(SESSION_COOKIE, "", 0) } });
}

async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

async function syncProgress(env, request, user) {
  const body = await readBody(request);
  const map = body && body.progress && typeof body.progress === "object" ? body.progress : null;
  if (!map) return json({ ok: false, error: "bad_request" }, { status: 400 });

  const entries = Object.entries(map).filter(([slug]) => /^[a-z0-9-]+$/.test(slug)).slice(0, 400);
  const stmts = entries.map(([slug, p]) => {
    p = p && typeof p === "object" ? p : {};
    const quiz = Number.isFinite(p.quiz) ? Math.max(0, Math.min(100, Math.round(p.quiz))) : null;
    return env.DB.prepare(
      `INSERT INTO progress (user_id, lesson_id, video_done, anim_done, game_done, quiz_best, updated_at)
       SELECT ?, l.id, ?, ?, ?, ?, datetime('now') FROM lessons l WHERE l.slug = ?
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET
         video_done = MAX(progress.video_done, excluded.video_done),
         anim_done = MAX(progress.anim_done, excluded.anim_done),
         game_done = MAX(progress.game_done, excluded.game_done),
         quiz_best = CASE
           WHEN progress.quiz_best IS NULL THEN excluded.quiz_best
           WHEN excluded.quiz_best IS NULL THEN progress.quiz_best
           ELSE MAX(progress.quiz_best, excluded.quiz_best)
         END,
         updated_at = datetime('now')`
    ).bind(user.id, p.video ? 1 : 0, p.anim ? 1 : 0, p.game ? 1 : 0, quiz, slug);
  });
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, ...(await loadMe(env, user)) }, { headers: NO_STORE });
}

async function toggleBookmark(env, request, user) {
  const body = await readBody(request);
  const slug = body && typeof body.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ ok: false, error: "bad_request" }, { status: 400 });
  const lesson = await env.DB.prepare(`SELECT id FROM lessons WHERE slug = ?`).bind(slug).first();
  if (!lesson) return json({ ok: false, error: "not_found" }, { status: 404 });

  const existing = await env.DB.prepare(
    `SELECT 1 AS x FROM bookmarks WHERE user_id = ? AND lesson_id = ?`
  ).bind(user.id, lesson.id).first();
  if (existing) {
    await env.DB.prepare(`DELETE FROM bookmarks WHERE user_id = ? AND lesson_id = ?`).bind(user.id, lesson.id).run();
    return json({ ok: true, bookmarked: false }, { headers: NO_STORE });
  }
  await env.DB.prepare(`INSERT INTO bookmarks (user_id, lesson_id) VALUES (?, ?)`).bind(user.id, lesson.id).run();
  return json({ ok: true, bookmarked: true }, { headers: NO_STORE });
}

const MAX_NOTE_LENGTH = 5000;

async function handleNotes(env, request, user, slug) {
  const lesson = await env.DB.prepare(`SELECT id FROM lessons WHERE slug = ?`).bind(slug).first();
  if (!lesson) return json({ ok: false, error: "not_found" }, { status: 404 });

  if (request.method === "GET") {
    const note = await env.DB.prepare(
      `SELECT body, created_at FROM notes WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 1`
    ).bind(user.id, lesson.id).first();
    return json({ ok: true, body: note ? note.body : "", updatedAt: note ? note.created_at : null }, { headers: NO_STORE });
  }

  const data = await readBody(request);
  const text = data && typeof data.body === "string" ? data.body.trim() : null;
  if (text === null || text.length > MAX_NOTE_LENGTH) return json({ ok: false, error: "bad_request" }, { status: 400 });

  // เก็บโน้ตหนึ่งชิ้นต่อหนึ่งบทเรียน: ลบของเดิมแล้วบันทึกใหม่ (ถ้าว่างคือลบโน้ต)
  const stmts = [env.DB.prepare(`DELETE FROM notes WHERE user_id = ? AND lesson_id = ?`).bind(user.id, lesson.id)];
  if (text) {
    stmts.push(env.DB.prepare(`INSERT INTO notes (user_id, lesson_id, body) VALUES (?, ?, ?)`).bind(user.id, lesson.id, text));
  }
  await env.DB.batch(stmts);
  return json({ ok: true, body: text }, { headers: NO_STORE });
}

// กัน CSRF: คำขอที่แก้ข้อมูลต้องมาจากหน้าเว็บของเราเอง
function sameOrigin(request, url) {
  const origin = request.headers.get("origin");
  return !origin || origin === url.origin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health") {
      return json({ ok: true, app: "learnphysics", time: new Date().toISOString() });
    }

    try {
      if (path === "/api/catalog" && request.method === "GET") {
        const rows = (await env.DB.prepare(CATALOG_SQL).all()).results;
        const lessons = (await env.DB.prepare(PUBLISHED_LESSONS_SQL).all()).results;
        return json(
          { ok: true, categories: groupCatalog(rows, lessons) },
          { headers: { "cache-control": "public, max-age=60" } }
        );
      }

      const lessonMatch = path.match(/^\/api\/lessons\/([a-z0-9-]+)$/);
      if (lessonMatch && request.method === "GET") {
        const user = await getSessionUser(env, request);
        if (!user) {
          return json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
        }
        const lesson = await getLesson(env, lessonMatch[1]);
        if (!lesson) return json({ ok: false, error: "not_found" }, { status: 404 });
        return json({ ok: true, lesson }, { headers: NO_STORE });
      }

      const quizMatch = path.match(/^\/api\/quizzes\/(\d+)\/check$/);
      if (quizMatch && request.method === "POST") {
        const user = await getSessionUser(env, request);
        if (!user) {
          return json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
        }
        return await checkQuiz(env, request, Number(quizMatch[1]), user);
      }

      // ---- ระบบสมาชิก
      if (path === "/api/auth/google" && request.method === "GET") {
        return startGoogleLogin(env, url);
      }
      if (path === "/api/auth/callback" && request.method === "GET") {
        return await googleCallback(env, request, url);
      }
      if (path === "/api/auth/logout" && request.method === "POST") {
        if (!sameOrigin(request, url)) return json({ ok: false, error: "forbidden" }, { status: 403 });
        return await logout(env, request);
      }

      const isMe = path === "/api/me";
      const isProgressSync = path === "/api/progress/sync";
      const isBookmark = path === "/api/bookmarks/toggle";
      const noteMatch = path.match(/^\/api\/notes\/([a-z0-9-]+)$/);
      if (isMe || isProgressSync || isBookmark || noteMatch) {
        const m = request.method;
        const allowed =
          (isMe && (m === "GET" || m === "DELETE")) ||
          ((isProgressSync || isBookmark) && m === "POST") ||
          (noteMatch && (m === "GET" || m === "POST"));
        if (!allowed) return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
        if (m !== "GET" && !sameOrigin(request, url)) return json({ ok: false, error: "forbidden" }, { status: 403 });

        const user = await getSessionUser(env, request);
        if (!user) {
          if (isMe && m === "GET") return json({ ok: true, user: null }, { headers: NO_STORE });
          return json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
        }
        if (isMe) return m === "GET" ? json(await loadMe(env, user), { headers: NO_STORE }) : await deleteAccount(env, request, user);
        if (isProgressSync) return await syncProgress(env, request, user);
        if (isBookmark) return await toggleBookmark(env, request, user);
        return await handleNotes(env, request, user, noteMatch[1]);
      }
    } catch (err) {
      console.error("api error", path, err);
      return json({ ok: false, error: "server_error" }, { status: 500 });
    }

    // path /api/ อื่นๆ ที่ยังไม่มี
    if (path.startsWith("/api/")) {
      return json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // นอกนั้นส่งต่อให้หน้าเว็บ
    return env.ASSETS.fetch(request);
  },
};
