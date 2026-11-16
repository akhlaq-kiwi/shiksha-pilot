-- Migration 048: Add attempt timer toggle, negative marking config, active elapsed tracking & obtained marks

ALTER TABLE test_series
    ADD COLUMN show_timer TINYINT(1) NOT NULL DEFAULT 0 AFTER total_questions,
    ADD COLUMN negative_marking_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER show_timer,
    ADD COLUMN negative_mark_value DECIMAL(4,2) NOT NULL DEFAULT 0.00 AFTER negative_marking_enabled;

ALTER TABLE test_series_attempts
    ADD COLUMN elapsed_seconds INT NOT NULL DEFAULT 0 AFTER time_taken_seconds,
    ADD COLUMN obtained_marks DECIMAL(7,2) NOT NULL DEFAULT 0.00 AFTER score_percent,
    MODIFY COLUMN score_percent DECIMAL(6,2) NOT NULL DEFAULT 0.00;

