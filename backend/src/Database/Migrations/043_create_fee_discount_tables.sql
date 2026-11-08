-- Migration: 043_create_fee_discount_tables.sql
-- Add discount approval toggle to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS discount_approval_required TINYINT(1) NOT NULL DEFAULT 0;

-- Create fee_discount_requests table
CREATE TABLE IF NOT EXISTS fee_discount_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    academic_year_id INT NULL,
    student_id INT NOT NULL,
    fee_type VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
    fee_items_summary VARCHAR(255) NOT NULL,
    deposit_payload LONGTEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    requested_by VARCHAR(150) NOT NULL,
    requested_by_id INT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    rejection_reason VARCHAR(255) NULL,
    approved_by VARCHAR(150) NULL,
    approved_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fdr_school_status (school_id, status),
    INDEX idx_fdr_student (student_id),
    INDEX idx_fdr_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

