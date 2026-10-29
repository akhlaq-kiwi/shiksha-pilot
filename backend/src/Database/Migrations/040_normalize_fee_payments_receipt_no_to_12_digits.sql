-- Normalize any legacy 15-digit receipt numbers to standard 12-digit Ref Numbers
UPDATE fee_payments SET receipt_no = SUBSTRING(receipt_no, 1, 12) WHERE LENGTH(receipt_no) = 15;
UPDATE additional_fee_payments SET receipt_no = SUBSTRING(receipt_no, 1, 12) WHERE LENGTH(receipt_no) = 15;
UPDATE additional_fee_payment_history SET receipt_no = SUBSTRING(receipt_no, 1, 12) WHERE LENGTH(receipt_no) = 15;

