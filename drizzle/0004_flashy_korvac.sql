CREATE TABLE `reminder_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`email_timing` text DEFAULT 'morning' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminder_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`assignment_id` integer NOT NULL,
	`reminder_type` text NOT NULL,
	`reminder_date` text NOT NULL,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reminder_sends_assignment_window` ON `reminder_sends` (`user_id`,`assignment_id`,`reminder_type`,`reminder_date`);