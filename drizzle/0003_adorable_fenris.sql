CREATE TABLE `canvas_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`base_url` text NOT NULL,
	`canvas_user_id` text NOT NULL,
	`canvas_user_name` text,
	`token_ciphertext` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_canvas_connections_user_id` ON `canvas_connections` (`user_id`);--> statement-breakpoint
ALTER TABLE `assignments` ADD `canvas_assignment_id` text;--> statement-breakpoint
ALTER TABLE `assignments` ADD `canvas_course_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_assignments_user_canvas_assignment` ON `assignments` (`user_id`,`canvas_assignment_id`);