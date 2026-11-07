// สร้างไฟล์ SQL สำหรับใส่บทเรียนจากโฟลเดอร์ content/lessons ลงฐานข้อมูล
// ใช้: node scripts/build-seed.mjs > migrations/0004_seed_pilot_lessons.sql
// รันซ้ำได้ (ลบบทเรียนเดิมที่ slug ตรงกันก่อนแล้วใส่ใหม่)
import fs from "node:fs";
import path from "node:path";

const dir = new URL("../content/lessons/", import.meta.url).pathname;
const q = (v) => (v === null || v === undefined ? "NULL" : "'" + String(v).replace(/'/g, "''") + "'");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();

const out = ["-- บทเรียนนำร่อง (สร้างจาก content/lessons ด้วย scripts/build-seed.mjs)"];
for (const f of files) {
  const l = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const lid = `(SELECT id FROM lessons WHERE slug = ${q(l.slug)})`;
  out.push(`\n-- ${l.slug}`);
  out.push(`DELETE FROM lessons WHERE slug = ${q(l.slug)};`);
  out.push(
    `INSERT INTO lessons (chapter_id, slug, title, summary, level, sort_order, status) VALUES ((SELECT id FROM chapters WHERE slug = ${q(l.chapter)}), ${q(l.slug)}, ${q(l.title)}, ${q(l.summary)}, ${q(l.level)}, ${l.sort_order ?? 0}, 'published');`
  );
  (l.videos || []).forEach((v, i) => {
    out.push(
      `INSERT INTO videos (lesson_id, provider, url, youtube_id, title, channel_name, channel_url, sort_order) VALUES (${lid}, ${q(v.provider || "youtube")}, ${q(v.url)}, ${q(v.youtube_id)}, ${q(v.title)}, ${q(v.channel_name)}, ${q(v.channel_url)}, ${i + 1});`
    );
  });
  if (l.animation) {
    out.push(`INSERT INTO animations (lesson_id, engine, title, config_json) VALUES (${lid}, ${q(l.animation.engine)}, ${q(l.animation.title)}, ${q(JSON.stringify(l.animation.config || {}))});`);
  }
  if (l.game) {
    out.push(`INSERT INTO games (lesson_id, template, title, config_json) VALUES (${lid}, ${q(l.game.template)}, ${q(l.game.title)}, ${q(JSON.stringify(l.game.config || {}))});`);
  }
  if (l.quiz) {
    out.push(`INSERT INTO quizzes (lesson_id, title, pass_score) VALUES (${lid}, ${q(l.quiz.title)}, ${l.quiz.pass_score ?? 60});`);
    const zid = `(SELECT id FROM quizzes WHERE lesson_id = ${lid})`;
    l.quiz.questions.forEach((qq, i) => {
      out.push(
        `INSERT INTO questions (quiz_id, type, body, choices_json, answer_json, explanation, sort_order) VALUES (${zid}, ${q(qq.type)}, ${q(qq.body)}, ${qq.choices ? q(JSON.stringify(qq.choices)) : "NULL"}, ${q(JSON.stringify(qq.answer))}, ${q(qq.explanation)}, ${i + 1});`
      );
    });
  }
}
console.log(out.join("\n"));
