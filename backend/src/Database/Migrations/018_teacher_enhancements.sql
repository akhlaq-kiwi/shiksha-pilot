ALTER TABLE staff
ADD COLUMN father_name VARCHAR(200) NULL,
ADD COLUMN emergency_phone VARCHAR(30) NULL,
ADD COLUMN exit_date DATE NULL,
ADD COLUMN current_address_line TEXT NULL,
ADD COLUMN current_city VARCHAR(100) NULL,
ADD COLUMN current_state VARCHAR(100) NULL,
ADD COLUMN current_country VARCHAR(100) NULL,
ADD COLUMN current_pin_code VARCHAR(20) NULL,
ADD COLUMN permanent_address_line TEXT NULL,
ADD COLUMN permanent_city VARCHAR(100) NULL,
ADD COLUMN permanent_state VARCHAR(100) NULL,
ADD COLUMN permanent_country VARCHAR(100) NULL,
ADD COLUMN permanent_pin_code VARCHAR(20) NULL,
ADD COLUMN same_as_current TINYINT(1) DEFAULT 0;

CREATE TABLE IF NOT EXISTS staff_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    staff_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);
