-- Migration 031: Redesign Examination module architecture (school-wide examinations)
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create examination_class_status table
CREATE TABLE IF NOT EXISTS examination_class_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    class_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'Draft', -- 'Draft', 'Published'
    publish_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_exam_class (exam_id, class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add class_id to examination_papers table
ALTER TABLE examination_papers ADD COLUMN class_id INT NULL AFTER exam_id;
ALTER TABLE examination_papers ADD CONSTRAINT fk_examination_papers_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- 3. Drop constraint and class_id column from examinations
ALTER TABLE examinations DROP FOREIGN KEY `3`;
ALTER TABLE examinations DROP COLUMN class_id;

SET FOREIGN_KEY_CHECKS = 1;
