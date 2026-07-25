-- Migration: Vocabulary Engine Schema Setup
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS vocabulary_words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    word VARCHAR(100) NOT NULL,
    part_of_speech ENUM('Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Conjunction', 'Interjection') NOT NULL,
    english_meaning TEXT NOT NULL,
    hindi_meaning TEXT NOT NULL,
    english_sentence TEXT NOT NULL,
    hindi_sentence TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    phonics VARCHAR(100) DEFAULT NULL,
    synonyms JSON DEFAULT NULL,
    opposites JSON DEFAULT NULL,
    image_path VARCHAR(255) DEFAULT NULL,
    audio_path VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_word_spelling (word),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vocabulary_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    word_id INT NOT NULL,
    academic_level VARCHAR(20) NOT NULL,
    stage_number INT NOT NULL,
    difficulty_score INT NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE,
    UNIQUE KEY uq_word_level_stage (word_id, academic_level, stage_number),
    INDEX idx_level_stage (academic_level, stage_number, difficulty_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_vocabulary_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    school_id INT NOT NULL,
    word_mapping_id INT NOT NULL,
    mastery_status ENUM('UNKNOWN', 'LEARNING', 'PRACTICING', 'MASTERED') NOT NULL DEFAULT 'UNKNOWN',
    correct_count INT NOT NULL DEFAULT 0,
    wrong_count INT NOT NULL DEFAULT 0,
    consecutive_correct INT NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMP NULL DEFAULT NULL,
    next_revision_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (word_mapping_id) REFERENCES vocabulary_mappings(id) ON DELETE CASCADE,
    UNIQUE KEY uq_student_word_state (student_id, word_mapping_id),
    INDEX idx_student_status (student_id, mastery_status),
    INDEX idx_revision_time (student_id, next_revision_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add new columns programmatically to the existing student_game_progress table
ALTER TABLE student_game_progress ADD COLUMN current_stage INT NOT NULL DEFAULT 1;
ALTER TABLE student_game_progress ADD COLUMN total_words_learned INT NOT NULL DEFAULT 0;
ALTER TABLE student_game_progress ADD COLUMN total_words_mastered INT NOT NULL DEFAULT 0;
ALTER TABLE student_game_progress ADD COLUMN accuracy_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE student_game_progress ADD COLUMN longest_streak INT NOT NULL DEFAULT 0;
ALTER TABLE student_game_progress ADD COLUMN daily_practice_days INT NOT NULL DEFAULT 0;
ALTER TABLE student_game_progress ADD COLUMN last_practice_date DATE NULL;

SET FOREIGN_KEY_CHECKS = 1;
