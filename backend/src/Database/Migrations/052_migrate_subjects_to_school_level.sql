-- Migration 052: Migrate subjects to school-level master subjects
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Update timetable references to the master subject ID
UPDATE timetable t
JOIN (
    SELECT s1.id, 
           (SELECT MIN(s2.id) 
            FROM subjects s2 
            WHERE s2.school_id = s1.school_id 
              AND LOWER(TRIM(s2.name)) = LOWER(TRIM(s1.name))) as master_id
    FROM subjects s1
) s ON t.subject_id = s.id
SET t.subject_id = s.master_id
WHERE t.subject_id != s.master_id;

-- 2. Update examination_papers references to the master subject ID
UPDATE examination_papers ep
JOIN (
    SELECT s1.id, 
           (SELECT MIN(s2.id) 
            FROM subjects s2 
            WHERE s2.school_id = s1.school_id 
              AND LOWER(TRIM(s2.name)) = LOWER(TRIM(s1.name))) as master_id
    FROM subjects s1
) s ON ep.subject_id = s.id
SET ep.subject_id = s.master_id
WHERE ep.subject_id != s.master_id;

-- 3. Update assignments references to the master subject ID
UPDATE assignments a
JOIN (
    SELECT s1.id, 
           (SELECT MIN(s2.id) 
            FROM subjects s2 
            WHERE s2.school_id = s1.school_id 
              AND LOWER(TRIM(s2.name)) = LOWER(TRIM(s1.name))) as master_id
    FROM subjects s1
) s ON a.subject_id = s.id
SET a.subject_id = s.master_id
WHERE a.subject_id != s.master_id;

-- 4. Update learning_materials references to the master subject ID
UPDATE learning_materials lm
JOIN (
    SELECT s1.id, 
           (SELECT MIN(s2.id) 
            FROM subjects s2 
            WHERE s2.school_id = s1.school_id 
              AND LOWER(TRIM(s2.name)) = LOWER(TRIM(s1.name))) as master_id
    FROM subjects s1
) s ON lm.subject_id = s.id
SET lm.subject_id = s.master_id
WHERE lm.subject_id != s.master_id;

-- 5. Delete duplicate subjects (keeping only the minimum ID for each name per school)
DELETE FROM subjects
WHERE id NOT IN (
    SELECT master_id FROM (
        SELECT MIN(id) as master_id
        FROM subjects
        GROUP BY school_id, LOWER(TRIM(name))
    ) as tmp
);

-- 6. Set class_id and teacher_id to NULL to make them school-level master subjects
UPDATE subjects SET class_id = NULL, teacher_id = NULL;

SET FOREIGN_KEY_CHECKS = 1;
