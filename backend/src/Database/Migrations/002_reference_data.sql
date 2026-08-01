-- =====================================================================
-- Migration 002: System reference data
--
-- The four built-in report card templates. These are platform reference
-- data, not demo data: schools.report_card_template_id points at these ids
-- and the print/report-card engine resolves layouts by their code.
-- =====================================================================

INSERT IGNORE INTO `report_card_templates` (`id`, `name`, `code`, `description`, `layout_config`, `is_system_default`) VALUES (1,'Modern School Report','modern','Sleek modern report card with gradient accents, summary stat cards, and 3-signature layout.','{\"header_style\":\"modern\",\"color_theme\":\"emerald\",\"show_ranks\":true,\"show_gpa\":true,\"show_attendance\":true,\"show_promotion_status\":true,\"signatures\":[\"Class Teacher\",\"Exam Incharge\",\"Principal\"]}',1);
INSERT IGNORE INTO `report_card_templates` (`id`, `name`, `code`, `description`, `layout_config`, `is_system_default`) VALUES (2,'Classic CBSE Style','cbse_classic','Formal CBSE style layout with double border, term-wise breakdown, grade points, and 2-signature layout.','{\"header_style\":\"cbse\",\"color_theme\":\"classic\",\"show_ranks\":true,\"show_gpa\":true,\"show_attendance\":true,\"show_promotion_status\":true,\"signatures\":[\"Class Teacher\",\"Principal\"]}',0);
INSERT IGNORE INTO `report_card_templates` (`id`, `name`, `code`, `description`, `layout_config`, `is_system_default`) VALUES (3,'Traditional School Format','traditional','Traditional certificate layout with double border, detailed marks table, and promotion verdict box.','{\"header_style\":\"traditional\",\"color_theme\":\"navy\",\"show_ranks\":true,\"show_gpa\":false,\"show_attendance\":true,\"show_promotion_status\":true,\"signatures\":[\"Class Teacher\",\"Principal\"]}',0);
INSERT IGNORE INTO `report_card_templates` (`id`, `name`, `code`, `description`, `layout_config`, `is_system_default`) VALUES (4,'Compact Primary Format','primary_compact','Single-page compact format for primary grades with essential performance metrics.','{\"header_style\":\"compact\",\"color_theme\":\"amber\",\"show_ranks\":false,\"show_gpa\":false,\"show_attendance\":true,\"show_promotion_status\":true,\"signatures\":[\"Teacher Signature\",\"Parent Signature\"]}',0);
