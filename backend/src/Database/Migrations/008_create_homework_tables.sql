-- Migration 008: Create homework and homework_attachments tables

CREATE TABLE IF NOT EXISTS `homework` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `school_id` INT NOT NULL,
  `class_id` INT DEFAULT NULL,
  `subject_id` INT DEFAULT NULL,
  `teacher_id` INT DEFAULT NULL,
  `title` VARCHAR(300) DEFAULT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_homework_school` (`school_id`),
  KEY `idx_homework_class` (`class_id`),
  KEY `idx_homework_teacher` (`teacher_id`),
  CONSTRAINT `homework_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `homework_ibfk_2` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `homework_attachments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `homework_id` INT NOT NULL,
  `file_name` VARCHAR(300) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_type` VARCHAR(50) NOT NULL DEFAULT 'file',
  `file_size` INT DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_homework_attachments_hw` (`homework_id`),
  CONSTRAINT `homework_attachments_ibfk_1` FOREIGN KEY (`homework_id`) REFERENCES `homework` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
