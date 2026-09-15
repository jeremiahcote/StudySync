DROP INDEX `idx_assignments_completed_due_at`;--> statement-breakpoint
ALTER TABLE `assignments` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `idx_assignments_user_completed_due_at` ON `assignments` (`user_id`,`completed`,`due_at`);