-- Migration 049: Create test_series_drafts table for storing teacher drafts in cloud

CREATE TABLE IF NOT EXISTS test_series_drafts (
    id VARCHAR(100) NOT NULL PRIMARY KEY,
    school_id INT NOT NULL,
    teacher_user_id INT NOT NULL,
    class_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    draft_data LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tsd_teacher_class (school_id, teacher_user_id, class_id),
    KEY idx_tsd_school (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
