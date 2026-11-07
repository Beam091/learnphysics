-- เพิ่มคอลัมน์จำนวนบทเรียนที่วางแผนไว้ในแต่ละบท (ใช้แสดงในหน้าหลักสูตร)
ALTER TABLE chapters ADD COLUMN planned_lessons INTEGER NOT NULL DEFAULT 0;
