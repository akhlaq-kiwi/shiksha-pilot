SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `report_card_templates`;

CREATE TABLE `report_card_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `layout_config` LONGTEXT NOT NULL,
  `is_system_default` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `schools` ADD COLUMN IF NOT EXISTS `report_card_template_id` INT NULL AFTER `principal_signature_path`;

INSERT IGNORE INTO `report_card_templates` (`name`, `code`, `description`, `layout_config`, `is_system_default`) VALUES
('Modern School Report', 'modern', 'Sleek modern report card with gradient accents, summary stat cards, and 3-signature layout.', '{"header_style":"modern","color_theme":"emerald","show_ranks":true,"show_gpa":true,"show_attendance":true,"show_promotion_status":true,"signatures":["Class Teacher","Exam Incharge","Principal"]}', 1),
('Classic CBSE Style', 'cbse_classic', 'Formal CBSE style layout with double border, term-wise breakdown, grade points, and 2-signature layout.', '{"header_style":"cbse","color_theme":"classic","show_ranks":true,"show_gpa":true,"show_attendance":true,"show_promotion_status":true,"signatures":["Class Teacher","Principal"]}', 0),
('Traditional School Format', 'traditional', 'Traditional certificate layout with double border, detailed marks table, and promotion verdict box.', '{"header_style":"traditional","color_theme":"navy","show_ranks":true,"show_gpa":false,"show_attendance":true,"show_promotion_status":true,"signatures":["Class Teacher","Principal"]}', 0),
('Compact Primary Format', 'primary_compact', 'Single-page compact format for primary grades with essential performance metrics.', '{"header_style":"compact","color_theme":"amber","show_ranks":false,"show_gpa":false,"show_attendance":true,"show_promotion_status":true,"signatures":["Teacher Signature","Parent Signature"]}', 0);

SET FOREIGN_KEY_CHECKS = 1;
