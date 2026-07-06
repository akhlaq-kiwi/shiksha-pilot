-- Migration 037: Remove demo plans and subscriptions

DELETE FROM subscriptions;
DELETE FROM plans;
