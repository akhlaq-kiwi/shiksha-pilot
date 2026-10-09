-- Migration 033: Add parent_id, max_marks, weightage_percent to examinations table for hierarchical terminals & sub-tests
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE examinations 
  ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER academic_year_id,
  ADD COLUMN max_marks DECIMAL(8,2) NULL DEFAULT NULL AFTER publish_date,
  ADD COLUMN weightage_percent DECIMAL(5,2) NULL DEFAULT NULL AFTER max_marks;

ALTER TABLE examinations
  ADD CONSTRAINT fk_examinations_parent
  FOREIGN KEY (parent_id) REFERENCES examinations(id)
  ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
