-- Migration 021: Create additional_fee_payment_history table for individual collection transactions

CREATE TABLE IF NOT EXISTS `additional_fee_payment_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_id` INT NOT NULL,
  `school_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'Cash',
  `collected_by` VARCHAR(100) NOT NULL DEFAULT 'School Admin',
  `receipt_no` VARCHAR(100) DEFAULT NULL,
  `payment_date` DATE DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `payment_id` (`payment_id`),
  KEY `school_id` (`school_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `additional_fee_payment_history_ibfk_1` FOREIGN KEY (`payment_id`) REFERENCES `additional_fee_payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
