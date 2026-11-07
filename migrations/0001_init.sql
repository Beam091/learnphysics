-- LearnPhysics: โครงฐานข้อมูล D1 (เวอร์ชันแรก)
-- รันด้วย: npx wrangler d1 migrations apply learnphysics-db --remote

-- ผู้ใช้ (ล็อกอินด้วย Google)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub    TEXT NOT NULL UNIQUE,
  email         TEXT,
  name          TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- หลักสูตร: หมวด > บท > บทเรียน
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chapters_category ON chapters(category_id);

CREATE TABLE IF NOT EXISTS lessons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  summary    TEXT,
  level      TEXT NOT NULL CHECK (level IN ('junior', 'senior')), -- junior = ม.ต้น, senior = ม.ปลาย
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);

-- คลิปสอน: ลิงก์ไปเปิดบนเว็บต้นทาง (ส่วนใหญ่เป็น YouTube) ไม่ได้ฝังเครื่องเล่น
CREATE TABLE IF NOT EXISTS videos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL DEFAULT 'youtube', -- youtube, dltv, plook, other
  url          TEXT NOT NULL,
  youtube_id   TEXT,
  title        TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_url  TEXT,
  duration_sec INTEGER,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  checked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_videos_lesson ON videos(lesson_id);

-- แอนิเมชั่น เกม แบบทดสอบ: ตั้งค่าด้วย JSON จากโฟลเดอร์ content/
CREATE TABLE IF NOT EXISTS animations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  engine      TEXT NOT NULL,
  title       TEXT,
  config_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_animations_lesson ON animations(lesson_id);

CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  template    TEXT NOT NULL,
  title       TEXT,
  config_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_games_lesson ON games(lesson_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title      TEXT,
  pass_score INTEGER NOT NULL DEFAULT 60
);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);

CREATE TABLE IF NOT EXISTS questions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'choice', -- choice, number, match
  body         TEXT NOT NULL,
  choices_json TEXT,
  answer_json  TEXT NOT NULL,
  explanation  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);

-- ข้อมูลของผู้เรียน
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL,
  total        INTEGER NOT NULL,
  answers_json TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);

CREATE TABLE IF NOT EXISTS progress (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  video_done INTEGER NOT NULL DEFAULT 0, -- ผู้เรียนกดติ๊ก "ดูแล้ว"
  anim_done  INTEGER NOT NULL DEFAULT 0,
  game_done  INTEGER NOT NULL DEFAULT 0,
  quiz_best  INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user_lesson ON notes(user_id, lesson_id);
