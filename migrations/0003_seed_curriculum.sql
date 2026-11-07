-- ใส่หมวดและบทตามแผนหลักสูตร 155 บทเรียน (รันซ้ำได้ ไม่ซ้ำข้อมูล)
INSERT OR IGNORE INTO categories (slug, title, sort_order) VALUES
  ('junior', 'ฟิสิกส์ ม.ต้น', 1),
  ('mechanics', 'กลศาสตร์ ม.ปลาย', 2),
  ('waves-sound', 'คลื่นและเสียง', 3),
  ('light-optics', 'แสงและทัศนูปกรณ์', 4),
  ('heat-gas', 'ความร้อนและแก๊ส', 5),
  ('electromagnetism', 'ไฟฟ้าและแม่เหล็ก', 6),
  ('modern-physics', 'ฟิสิกส์ยุคใหม่', 7);

WITH v(cat, slug, title, sort_order, planned) AS (VALUES
  ('junior', 'jr-forces-motion', 'แรงและการเคลื่อนที่', 1, 6),
  ('junior', 'jr-work-energy', 'งานและพลังงาน', 2, 4),
  ('junior', 'jr-pressure-fluids', 'ความดันและของไหล', 3, 4),
  ('junior', 'jr-heat', 'ความร้อน', 4, 4),
  ('junior', 'jr-sound', 'เสียง', 5, 3),
  ('junior', 'jr-light', 'แสง', 6, 4),
  ('junior', 'jr-electricity', 'ไฟฟ้า', 7, 5),
  ('junior', 'jr-magnetism', 'แม่เหล็ก', 8, 3),
  ('mechanics', 'units-measurement', 'หน่วยและการวัด', 9, 4),
  ('mechanics', 'vectors', 'เวกเตอร์', 10, 4),
  ('mechanics', 'straight-line-motion', 'การเคลื่อนที่แนวตรง', 11, 6),
  ('mechanics', 'projectile', 'โพรเจกไทล์', 12, 4),
  ('mechanics', 'newton-laws', 'กฎของนิวตัน', 13, 6),
  ('mechanics', 'friction', 'แรงเสียดทาน', 14, 3),
  ('mechanics', 'circular-motion', 'การเคลื่อนที่แนววงกลม', 15, 4),
  ('mechanics', 'work-energy', 'งานและพลังงาน', 16, 5),
  ('mechanics', 'momentum-collisions', 'โมเมนตัมและการชน', 17, 5),
  ('mechanics', 'equilibrium-rotation', 'สมดุลและการหมุน', 18, 4),
  ('mechanics', 'oscillation-gravity', 'การสั่นและความโน้มถ่วง', 19, 5),
  ('waves-sound', 'mechanical-waves', 'คลื่นกล', 20, 5),
  ('waves-sound', 'wave-properties', 'สมบัติของคลื่น', 21, 4),
  ('waves-sound', 'sound', 'เสียง', 22, 5),
  ('light-optics', 'reflection-refraction', 'การสะท้อนและการหักเห', 23, 5),
  ('light-optics', 'lenses', 'เลนส์', 24, 5),
  ('heat-gas', 'temperature-heat', 'อุณหภูมิและความร้อน', 25, 5),
  ('heat-gas', 'kinetic-theory', 'ทฤษฎีจลน์ของแก๊ส', 26, 4),
  ('heat-gas', 'thermodynamics', 'เทอร์โมไดนามิกส์', 27, 5),
  ('electromagnetism', 'electrostatics', 'ไฟฟ้าสถิต', 28, 6),
  ('electromagnetism', 'circuits', 'วงจรไฟฟ้า', 29, 7),
  ('electromagnetism', 'magnetism', 'แม่เหล็ก', 30, 5),
  ('electromagnetism', 'induction-ac', 'การเหนี่ยวนำและไฟฟ้ากระแสสลับ', 31, 4),
  ('modern-physics', 'relativity', 'สัมพัทธภาพ', 32, 3),
  ('modern-physics', 'quantum-atom', 'ควอนตัมและอะตอม', 33, 5),
  ('modern-physics', 'nuclear', 'นิวเคลียร์', 34, 4)
)
INSERT OR IGNORE INTO chapters (category_id, slug, title, sort_order, planned_lessons)
SELECT c.id, v.slug, v.title, v.sort_order, v.planned FROM v JOIN categories c ON c.slug = v.cat;
