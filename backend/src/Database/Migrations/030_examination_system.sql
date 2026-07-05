-- Migration 030: Examination and Report Card Management System
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS examinations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    class_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    publish_date DATE NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) DEFAULT 'Draft', -- 'Draft', 'Published'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS examination_papers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    subject_id INT NOT NULL,
    exam_date DATE NOT NULL,
    start_time VARCHAR(20) NOT NULL,
    end_time VARCHAR(20) NOT NULL,
    max_marks DECIMAL(8,2) NOT NULL,
    passing_marks DECIMAL(8,2) NOT NULL,
    room VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS examination_marks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    paper_id INT NOT NULL,
    student_id INT NOT NULL,
    marks_obtained DECIMAL(8,2) NULL,
    is_absent TINYINT(1) DEFAULT 0,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_student_paper (paper_id, student_id),
    FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES examination_papers(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grade_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    min_percentage DECIMAL(5,2) NOT NULL,
    max_percentage DECIMAL(5,2) NOT NULL,
    grade VARCHAR(10) NOT NULL,
    grade_point INT NOT NULL DEFAULT 0,
    remark VARCHAR(100) NULL,
    UNIQUE KEY unique_school_grade (school_id, grade),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Populate default grade scales
INSERT IGNORE INTO grade_configurations (school_id, min_percentage, max_percentage, grade, grade_point, remark) VALUES
(1, 91.00, 100.00, 'A+', 10, 'Outstanding'),
(1, 81.00, 90.00, 'A', 9, 'Excellent'),
(1, 71.00, 80.00, 'B+', 8, 'Very Good'),
(1, 61.00, 70.00, 'B', 7, 'Good'),
(1, 51.00, 60.00, 'C', 6, 'Average'),
(1, 41.00, 50.00, 'D', 5, 'Pass'),
(1, 0.00, 40.00, 'F', 0, 'Fail');

SET FOREIGN_KEY_CHECKS = 1;
