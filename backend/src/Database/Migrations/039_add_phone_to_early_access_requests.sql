-- Migration 039: phone number on early access requests
--
-- The early-access form now asks for a phone number and requires it, so an
-- admin can reach someone whose Google account turns out to be unusable for
-- the Play tester list (a work address that is not a Google account is the
-- common case, and there is no way to tell from the address alone).
--
-- NULL-able on purpose: sign-ups collected before this migration have no phone
-- number and there is nothing honest to backfill them with. The requirement is
-- enforced at the form, not by the column — a NOT NULL default of '' would
-- just be a lie stored in every old row.

ALTER TABLE `early_access_requests`
  ADD COLUMN `phone` VARCHAR(30) NULL AFTER `name`;
