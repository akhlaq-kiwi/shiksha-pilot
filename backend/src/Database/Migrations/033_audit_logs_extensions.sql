ALTER TABLE audit_logs 
  ADD COLUMN module VARCHAR(100) NULL AFTER action,
  ADD COLUMN description TEXT NULL AFTER module,
  ADD COLUMN performed_by VARCHAR(255) NULL AFTER user,
  ADD COLUMN academic_year VARCHAR(100) NULL AFTER user_role,
  ADD COLUMN device VARCHAR(255) NULL AFTER ip_address;
