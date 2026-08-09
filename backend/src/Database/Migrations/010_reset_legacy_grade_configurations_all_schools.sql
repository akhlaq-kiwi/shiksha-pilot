-- =====================================================================
-- Migration 010: Reset legacy default 7-grade scale for all schools
-- =====================================================================

-- Delete legacy grade configuration scales (containing 'A+' or 'B+') across ALL schools
-- so they auto-seed to the standard A-D scale when accessed.
DELETE FROM grade_configurations 
WHERE school_id IN (
    SELECT sid FROM (
        SELECT DISTINCT school_id AS sid FROM grade_configurations WHERE grade IN ('A+', 'B+')
    ) AS legacy_schools
);

-- Ensure default A-D scale exists for school_id = 1
INSERT IGNORE INTO grade_configurations (school_id, min_percentage, max_percentage, grade, grade_point, remark)
SELECT 1, 75.00, 100.00, 'A', 10, 'Excellent' WHERE NOT EXISTS (SELECT 1 FROM grade_configurations WHERE school_id = 1)
UNION ALL
SELECT 1, 60.00, 74.99, 'B', 8, 'Good' WHERE NOT EXISTS (SELECT 1 FROM grade_configurations WHERE school_id = 1)
UNION ALL
SELECT 1, 40.00, 59.99, 'C', 6, 'Average' WHERE NOT EXISTS (SELECT 1 FROM grade_configurations WHERE school_id = 1)
UNION ALL
SELECT 1, 0.00, 39.99, 'D', 0, 'Fail' WHERE NOT EXISTS (SELECT 1 FROM grade_configurations WHERE school_id = 1);
