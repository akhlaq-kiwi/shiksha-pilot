-- Migration 020: Add discount_amount and amount_paid to fee payment tables and support Partial status for additional fees

ALTER TABLE `fee_payments` 
  ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `amount_paid`;

ALTER TABLE `additional_fee_payments` 
  ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `amount`,
  ADD COLUMN `amount_paid` DECIMAL(12,2) DEFAULT NULL AFTER `discount_amount`,
  MODIFY COLUMN `status` ENUM('Pending','Paid','Partial') NOT NULL DEFAULT 'Pending';

UPDATE `additional_fee_payments` 
  SET `status` = 'Partial' 
  WHERE `amount_paid` IS NOT NULL AND `amount_paid` > 0 AND (`amount_paid` + `discount_amount`) < `amount` AND `status` = 'Pending';
