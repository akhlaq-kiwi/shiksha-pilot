-- Migration: Align collected_by column collations to match users.name table collation
ALTER TABLE `fee_payments` MODIFY COLUMN `collected_by` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;
ALTER TABLE `additional_fee_payments` MODIFY COLUMN `collected_by` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;
ALTER TABLE `additional_fee_payment_history` MODIFY COLUMN `collected_by` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;
