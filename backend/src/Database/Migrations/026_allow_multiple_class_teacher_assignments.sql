-- Migration 026: Allow multiple class teacher assignments by making teacher_id non-unique
ALTER TABLE `class_teacher_assignments` DROP INDEX `teacher_id`;
ALTER TABLE `class_teacher_assignments` ADD INDEX `idx_teacher_id` (`teacher_id`);
