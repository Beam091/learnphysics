// สร้างไฟล์ SQL สำหรับใส่บทเรียนจากโฟลเดอร์ content/lessons ลงฐานข้อมูลแบบปลอดภัย (รักษา ID และข้อมูลผู้ใช้)
// ใช้: node scripts/build-seed.mjs
// หรือ: node scripts/build-seed.mjs > migrations/0005_seed_all_lessons.sql
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../content/lessons/", import.meta.url));
const outFile = fileURLToPath(new URL("../migrations/0005_seed_all_lessons.sql", import.meta.url));

const q = (v) => (v === null || v === undefined ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();

const out = [
  "-- Seed ALL lessons (154) from content/lessons/*.json (regenerable via scripts/build-seed.mjs)",
  "-- โครงสร้างปลอดภัย: Upsert lessons & quizzes เพื่อรักษา id ป้องกันการลบข้อมูลผู้ใช้แบบ CASCADE (progress, bookmarks, notes, quiz_attempts)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_lesson_unique ON quizzes(lesson_id);",
];

for (const f of files) {
  const l = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const lid = `(SELECT id FROM lessons WHERE slug = ${q(l.slug)})`;
  out.push(`\n-- ${l.slug}`);
  out.push(
    `INSERT INTO lessons (chapter_id, slug, title, summary, level, sort_order, status) VALUES ((SELECT id FROM chapters WHERE slug = ${q(l.chapter)}), ${q(l.slug)}, ${q(l.title)}, ${q(l.summary)}, ${q(l.level)}, ${l.sort_order ?? 0}, 'published') ON CONFLICT(slug) DO UPDATE SET chapter_id=excluded.chapter_id, title=excluded.title, summary=excluded.summary, level=excluded.level, sort_order=excluded.sort_order, status=excluded.status;`
  );

  out.push(`DELETE FROM videos WHERE lesson_id = (SELECT id FROM lessons WHERE slug = ${q(l.slug)});`);
  out.push(`DELETE FROM animations WHERE lesson_id = (SELECT id FROM lessons WHERE slug = ${q(l.slug)});`);
  out.push(`DELETE FROM games WHERE lesson_id = (SELECT id FROM lessons WHERE slug = ${q(l.slug)});`);

  (l.videos || []).forEach((v, i) => {
    out.push(
      `INSERT INTO videos (lesson_id, provider, url, youtube_id, title, channel_name, channel_url, sort_order) VALUES (${lid}, ${q(v.provider || "youtube")}, ${q(v.url)}, ${q(v.youtube_id)}, ${q(v.title)}, ${q(v.channel_name)}, ${q(v.channel_url)}, ${i + 1});`
    );
  });

  if (l.animation) {
    out.push(
      `INSERT INTO animations (lesson_id, engine, title, config_json) VALUES (${lid}, ${q(l.animation.engine)}, ${q(l.animation.title)}, ${q(JSON.stringify(l.animation.config || {}))});`
    );
  }

  if (l.game) {
    out.push(
      `INSERT INTO games (lesson_id, template, title, config_json) VALUES (${lid}, ${q(l.game.template)}, ${q(l.game.title)}, ${q(JSON.stringify(l.game.config || {}))});`
    );
  }

  if (l.quiz) {
    out.push(
      `INSERT INTO quizzes (lesson_id, title, pass_score) VALUES ((SELECT id FROM lessons WHERE slug = ${q(l.slug)}), ${q(l.quiz.title)}, ${l.quiz.pass_score ?? 60}) ON CONFLICT(lesson_id) DO UPDATE SET title=excluded.title, pass_score=excluded.pass_score;`
    );
    out.push(
      `DELETE FROM questions WHERE quiz_id = (SELECT id FROM quizzes WHERE lesson_id = (SELECT id FROM lessons WHERE slug = ${q(l.slug)}));`
    );
    const zid = `(SELECT id FROM quizzes WHERE lesson_id = (SELECT id FROM lessons WHERE slug = ${q(l.slug)}))`;
    l.quiz.questions.forEach((qq, i) => {
      out.push(
        `INSERT INTO questions (quiz_id, type, body, choices_json, answer_json, explanation, sort_order) VALUES (${zid}, ${q(qq.type)}, ${q(qq.body)}, ${qq.choices ? q(JSON.stringify(qq.choices)) : "NULL"}, ${q(JSON.stringify(qq.answer))}, ${q(qq.explanation)}, ${i + 1});`
      );
    });
  }
}

const content = out.join("\n") + "\n";
fs.writeFileSync(outFile, content, "utf8");
console.log(`Generated ${outFile} successfully (${files.length} lessons)`);
