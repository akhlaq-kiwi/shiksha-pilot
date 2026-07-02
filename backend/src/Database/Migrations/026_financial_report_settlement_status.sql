-- Migration 026: Add 'Request Sent' to financial_reports status ENUM
ALTER TABLE financial_reports MODIFY COLUMN status ENUM('Pending', 'Request Sent', 'Settled') NOT NULL DEFAULT 'Pending';
