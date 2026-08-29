-- Account deletion requests (PF-04).
--
-- Google Play requires an app with accounts to offer a deletion route both
-- in-app and at a public web URL. Accounts here are provisioned by the school
-- and their attendance/fee/exam history is records the school is expected to
-- keep, so deletion is request-and-erase rather than self-service: the user
-- files a request, a school admin fulfils it, and fulfilment scrubs the login
-- identity while leaving the academic record intact.
--
-- `contact_phone` is captured at request time because the users row it came
-- from is anonymised on completion — without it there is no way to tell the
-- requester the job is done, and no audit trail of who asked.

CREATE TABLE IF NOT EXISTS `account_deletion_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `school_id` INT DEFAULT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `contact_name` VARCHAR(255) NOT NULL,
  `reason` TEXT,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `resolution_note` TEXT,
  `resolved_by` INT DEFAULT NULL,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_adr_school_status` (`school_id`, `status`),
  KEY `idx_adr_user_status` (`user_id`, `status`),
  CONSTRAINT `adr_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `adr_school_fk` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
