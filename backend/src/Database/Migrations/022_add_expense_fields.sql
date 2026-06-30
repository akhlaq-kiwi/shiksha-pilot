ALTER TABLE `school_expenses` 
ADD COLUMN `category` VARCHAR(100) NOT NULL DEFAULT 'Other',
ADD COLUMN `payment_method` VARCHAR(50) NOT NULL DEFAULT 'Cash',
ADD COLUMN `reference_number` VARCHAR(100) DEFAULT NULL;
