-- =====================================================================
-- Migration 009: Update default grade configurations to A-D scale
-- =====================================================================

-- Re-seed grade configurations for QA school 1 if it is currently using the old 7-grade scale (A+ to F with min_percentage 91.00)
DELETE FROM grade_configurations 
WHERE school_id = 1 
  AND EXISTS (
    SELECT 1 FROM (
      SELECT COUNT(*) as cnt FROM grade_configurations WHERE school_id = 1 AND grade IN ('A+', 'B+')
    ) t WHERE t.cnt > 0
  );

INSERT IGNORE INTO grade_configurations (school_id, min_percentage, max_percentage, grade, grade_point, remark) VALUES
(1, 75.00, 100.00, 'A', 10, 'Excellent'),
(1, 60.00, 74.99, 'B', 8, 'Good'),
(1, 40.00, 59.99, 'C', 6, 'Average'),
(1, 0.00, 39.99, 'D', 0, 'Fail');
