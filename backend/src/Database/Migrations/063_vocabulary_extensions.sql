-- Migration: Vocabulary Engine Extensions for Challenges, Badges, and Stats
SET FOREIGN_KEY_CHECKS = 0;

-- Extend vocabulary_words with CEFR levels and tags
ALTER TABLE vocabulary_words ADD COLUMN cefr_level ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2') DEFAULT NULL;
ALTER TABLE vocabulary_words ADD COLUMN tags VARCHAR(255) DEFAULT NULL;

-- Create student_challenges table to track Daily/Weekly/Monthly challenge records
CREATE TABLE IF NOT EXISTS student_challenges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    school_id INT NOT NULL,
    challenge_type ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    challenge_date DATE NOT NULL,
    word_ids JSON NOT NULL,
    is_completed TINYINT NOT NULL DEFAULT 0,
    score_earned INT NOT NULL DEFAULT 0,
    xp_earned INT NOT NULL DEFAULT 0,
    coins_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY uq_student_challenge (student_id, challenge_type, challenge_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create student_achievements table to store unlocked badges/achievements
CREATE TABLE IF NOT EXISTS student_achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    school_id INT NOT NULL,
    achievement_key VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY uq_student_achievement (student_id, achievement_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
