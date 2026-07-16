-- Migration 048: Add payment details to fee_payments and additional_fee_payments
ALTER TABLE fee_payments ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash';
ALTER TABLE fee_payments ADD COLUMN collected_by VARCHAR(100) NOT NULL DEFAULT 'School Admin';

ALTER TABLE additional_fee_payments ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash';
ALTER TABLE additional_fee_payments ADD COLUMN collected_by VARCHAR(100) NOT NULL DEFAULT 'School Admin';
ALTER TABLE additional_fee_payments ADD COLUMN receipt_no VARCHAR(100) DEFAULT NULL;
