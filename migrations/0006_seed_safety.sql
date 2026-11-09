-- เพิ่ม UNIQUE index บน lesson_id ในตาราง quizzes
-- เพื่อให้คำสั่ง seed สามารถใช้ ON CONFLICT(lesson_id) DO UPDATE สำหรับตาราง quizzes ได้
-- โดยไม่ทำให้ quiz id เปลี่ยนแปลง และไม่ทำให้ข้อมูล quiz_attempts ของผู้เรียนสูญหาย (เนื่องจาก ON DELETE CASCADE)

CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_lesson_unique ON quizzes(lesson_id);
