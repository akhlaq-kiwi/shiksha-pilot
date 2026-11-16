-- Migration 047: Test Series feature tables

CREATE TABLE IF NOT EXISTS test_series_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    teacher_staff_id INT NOT NULL,
    user_id INT NULL DEFAULT NULL,
    can_create TINYINT(1) NOT NULL DEFAULT 1,
    granted_by_user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tsp_school_staff (school_id, teacher_staff_id),
    KEY idx_tsp_school_create (school_id, can_create)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_series (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NULL DEFAULT NULL,
    class_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    subject_name VARCHAR(150) NULL DEFAULT NULL,
    description TEXT NULL DEFAULT NULL,
    created_by_user_id INT NOT NULL,
    created_by_name VARCHAR(255) NOT NULL DEFAULT '',
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    total_questions INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ts_school_class_time (school_id, class_id, starts_at, ends_at),
    KEY idx_ts_creator (school_id, created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_series_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_series_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    question_text TEXT NULL DEFAULT NULL,
    question_image_url VARCHAR(500) NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tsq_series_order (test_series_id, sort_order),
    CONSTRAINT fk_tsq_series FOREIGN KEY (test_series_id) REFERENCES test_series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_series_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    option_text VARCHAR(500) NULL DEFAULT NULL,
    option_image_url VARCHAR(500) NULL DEFAULT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_tso_question_order (question_id, sort_order),
    CONSTRAINT fk_tso_question FOREIGN KEY (question_id) REFERENCES test_series_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_series_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_series_id INT NOT NULL,
    school_id INT NOT NULL,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    submitted_by_user_id INT NOT NULL,
    started_at DATETIME NOT NULL,
    submitted_at DATETIME NULL DEFAULT NULL,
    time_taken_seconds INT NOT NULL DEFAULT 0,
    total_questions INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    wrong_count INT NOT NULL DEFAULT 0,
    unanswered_count INT NOT NULL DEFAULT 0,
    score_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    status ENUM('IN_PROGRESS', 'SUBMITTED') NOT NULL DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tsa_series_student (test_series_id, student_id),
    KEY idx_tsa_leaderboard (test_series_id, status, correct_count, time_taken_seconds, submitted_at),
    KEY idx_tsa_school_student (school_id, student_id),
    CONSTRAINT fk_tsa_series FOREIGN KEY (test_series_id) REFERENCES test_series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_series_attempt_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option_id INT NULL DEFAULT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tsaa_attempt_question (attempt_id, question_id),
    KEY idx_tsaa_question (question_id),
    CONSTRAINT fk_tsaa_attempt FOREIGN KEY (attempt_id) REFERENCES test_series_attempts(id) ON DELETE CASCADE,
    CONSTRAINT fk_tsaa_question FOREIGN KEY (question_id) REFERENCES test_series_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

