-- Migration 015: Create class_fee_configurations table
CREATE TABLE IF NOT EXISTS class_fee_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    class_id INT NOT NULL,
    mode ENUM('SAME', 'DIFFERENT') NOT NULL DEFAULT 'SAME',
    monthly_fees TEXT NOT NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE KEY school_class_year (school_id, class_id, academic_year_id)
);
