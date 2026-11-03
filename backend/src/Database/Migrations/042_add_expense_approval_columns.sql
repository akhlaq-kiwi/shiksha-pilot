-- Add expense_approval_required toggle to schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS expense_approval_required TINYINT(1) NOT NULL DEFAULT 0;

-- Add approval_status and approval tracking columns to school_expenses
ALTER TABLE school_expenses ADD COLUMN IF NOT EXISTS approval_status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Approved';
ALTER TABLE school_expenses ADD COLUMN IF NOT EXISTS approved_by INT NULL;
ALTER TABLE school_expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;

