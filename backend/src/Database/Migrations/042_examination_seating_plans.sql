-- Migration 042: Examination Seating Plan & Seating Allocations
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS examination_seating_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    exam_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    students_per_bench INT NOT NULL,
    room_configs JSON NOT NULL, -- list of rooms and their bench count configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_exam_seating (exam_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS examination_seating_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seating_plan_id INT NOT NULL,
    student_id INT NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    bench_number INT NOT NULL,
    seat_position VARCHAR(10) NOT NULL, -- 'L', 'M', 'R'
    seat_number VARCHAR(20) NOT NULL, -- 'B-17-L'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seating_plan_id) REFERENCES examination_seating_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_seating (seating_plan_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
