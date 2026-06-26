CREATE TABLE IF NOT EXISTS plans (
    id              INT          NOT NULL AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    price           INT          NOT NULL DEFAULT 0,
    student_limit   INT          NULL COMMENT 'NULL means unlimited',
    description     TEXT         NULL,
    type            ENUM('standard','trial','custom') NOT NULL DEFAULT 'custom',
    trial_duration  INT          NULL,
    trial_unit      ENUM('day','month','year') NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the three built-in plans
INSERT INTO plans (name, price, student_limit, description, type) VALUES
('Standard',   7999,  1500, 'Includes standard gradebooks and audit logs up to 1,500 students.', 'standard'),
('Premium',    19999, 5000, 'Includes dynamic timetables, color themes, and multi-branch configurations.', 'standard'),
('Enterprise', 39999, NULL, 'Unlimited students, custom domain matching, and dedicated audit log exports.', 'standard');
