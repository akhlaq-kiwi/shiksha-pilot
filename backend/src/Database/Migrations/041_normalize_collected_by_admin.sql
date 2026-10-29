-- Normalize collected_by for school admin payments to 'ADMIN'
UPDATE fee_payments 
SET collected_by = 'ADMIN' 
WHERE LOWER(collected_by) LIKE '%admin%' OR collected_by = 'School Admin' OR collected_by IS NULL OR collected_by = '';

UPDATE additional_fee_payments 
SET collected_by = 'ADMIN' 
WHERE (LOWER(collected_by) LIKE '%admin%' OR collected_by = 'School Admin' OR collected_by = '') AND collected_by IS NOT NULL;

UPDATE additional_fee_payment_history 
SET collected_by = 'ADMIN' 
WHERE LOWER(collected_by) LIKE '%admin%' OR collected_by = 'School Admin' OR collected_by IS NULL OR collected_by = '';

