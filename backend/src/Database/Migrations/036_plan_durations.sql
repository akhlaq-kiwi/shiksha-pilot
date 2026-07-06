-- Migration 036: Add plan durations and subscription details

-- Update plans table
ALTER TABLE plans ADD COLUMN duration_value INT NOT NULL DEFAULT 12;
ALTER TABLE plans ADD COLUMN duration_unit ENUM('month', 'year') NOT NULL DEFAULT 'month';

-- Update standard plans to have correct default values
UPDATE plans SET duration_value = 1, duration_unit = 'month' WHERE name IN ('Standard', 'Premium');
UPDATE plans SET duration_value = 12, duration_unit = 'month' WHERE name = 'Enterprise';

-- Update subscriptions table
ALTER TABLE subscriptions ADD COLUMN plan_name VARCHAR(100) NULL;
ALTER TABLE subscriptions ADD COLUMN duration_value INT NULL;
ALTER TABLE subscriptions ADD COLUMN duration_unit VARCHAR(20) NULL;
ALTER TABLE subscriptions ADD COLUMN start_date DATE NULL;
ALTER TABLE subscriptions ADD COLUMN expiry_date DATE NULL;
ALTER TABLE subscriptions ADD COLUMN type VARCHAR(50) NULL DEFAULT 'new';

-- Seed default subscriptions for existing active schools if they don't have any
INSERT INTO subscriptions (school_id, invoice_no, amount, billing_cycle, status, plan_name, duration_value, duration_unit, start_date, expiry_date, type, created_at)
SELECT 
    s.id, 
    CONCAT('INV-SEED-', s.id), 
    CASE 
        WHEN s.plan = 'Standard' THEN 7999.00
        WHEN s.plan = 'Premium' THEN 19999.00
        WHEN s.plan = 'Enterprise' THEN 39999.00
        ELSE 0.00
    END,
    '12 Month',
    'PAID',
    s.plan,
    12,
    'month',
    '2026-04-01',
    '2027-03-31',
    'new',
    CURRENT_TIMESTAMP
FROM schools s
WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions sub WHERE sub.school_id = s.id
);
