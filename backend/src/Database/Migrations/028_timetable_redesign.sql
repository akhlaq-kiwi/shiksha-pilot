-- Migration 028: Timetable Redesign
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create Period Configurations table
CREATE TABLE IF NOT EXISTS period_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    period_number INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE KEY unique_school_period (school_id, period_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Modify subjects table's teacher foreign key constraint to reference staff(id)
ALTER TABLE subjects DROP FOREIGN KEY `3`;
ALTER TABLE subjects ADD CONSTRAINT fk_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES staff(id) ON DELETE SET NULL;

-- 3. Recreate timetable table with recurring and period number structure
DROP TABLE IF EXISTS timetable;
CREATE TABLE timetable (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    period_number INT NOT NULL,
    is_published TINYINT(1) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE KEY unique_class_period_day (class_id, period_number, day_of_week, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create timetable backups table for date-specific overrides
CREATE TABLE IF NOT EXISTS timetable_backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    timetable_id INT NOT NULL,
    date DATE NOT NULL,
    backup_teacher_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (timetable_id) REFERENCES timetable(id) ON DELETE CASCADE,
    FOREIGN KEY (backup_teacher_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE KEY unique_timetable_backup (timetable_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
