-- Migration 013: Add fee_month to fee_payments
ALTER TABLE fee_payments ADD COLUMN fee_month VARCHAR(50) NULL DEFAULT NULL;
