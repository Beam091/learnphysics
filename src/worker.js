// Worker ของ LearnPhysics
// ทำหน้าที่เป็นระบบหลังบ้านสำหรับทุก path ที่ขึ้นต้นด้วย /api/
//   GET  /api/health
//   GET  /api/catalog              หลักสูตร (หมวด > บท > บทเรียนที่เปิดแล้ว)
//   GET  /api/lessons/:slug        รายละเอียดบทเรียน (ไม่ส่งเฉลยไปด้วย)
//   POST /api/quizzes/:id/check    ตรวจคำตอบแบบทดสอบ (ตรวจฝั่งเซิร์ฟเวอร์)
// เฟสถัดไปจะเพิ่ม: login ด้วย Google และการบันทึกความคืบหน้า

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

async function checkQuiz(env, request, quizId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const answers = body && typeof body.answers === "object" && body.answers ? body.answers : null;
  if (!answers) return json({ ok: false, error: "bad_request" }, { status: 400 });

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
  return json({ ok: true, score, total, percent, passed: percent >= quiz.pass_score, results });
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
        const lesson = await getLesson(env, lessonMatch[1]);
        if (!lesson) return json({ ok: false, error: "not_found" }, { status: 404 });
        return json({ ok: true, lesson }, { headers: { "cache-control": "public, max-age=60" } });
      }

      const quizMatch = path.match(/^\/api\/quizzes\/(\d+)\/check$/);
      if (quizMatch && request.method === "POST") {
        return await checkQuiz(env, request, Number(quizMatch[1]));
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
