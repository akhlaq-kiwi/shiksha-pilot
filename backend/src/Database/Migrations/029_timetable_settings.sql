-- Migration 029: Timetable Settings and Period Configuration Versioning
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS school_timetable_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    school_start_time TIME NOT NULL,
    period_duration INT NOT NULL,
    interval_duration INT NOT NULL,
    interval_after_period INT NOT NULL,
    total_periods INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modify period_configurations table to support date range versioning
ALTER TABLE period_configurations DROP INDEX unique_school_period;
ALTER TABLE period_configurations ADD COLUMN start_date DATE NOT NULL DEFAULT '2020-01-01';
ALTER TABLE period_configurations ADD COLUMN end_date DATE NULL DEFAULT NULL;

SET FOREIGN_KEY_CHECKS = 1;
