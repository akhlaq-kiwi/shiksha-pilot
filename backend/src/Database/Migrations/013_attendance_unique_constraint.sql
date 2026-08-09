-- Migration 013: Clean up duplicate attendance records and enforce unique key on (school_id, student_id, date)

-- 1. Delete duplicate attendance records, retaining only the latest entry per student per date
DELETE a1 FROM `attendance` a1
INNER JOIN `attendance` a2 
ON a1.school_id = a2.school_id 
AND a1.student_id = a2.student_id 
AND a1.date = a2.date 
AND a1.id < a2.id;

-- 2. Add unique constraint so MySQL natively enforces 1 attendance record per student per date
ALTER TABLE `attendance` ADD UNIQUE KEY `uq_school_student_date` (`school_id`, `student_id`, `date`);
