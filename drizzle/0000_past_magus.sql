CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`course` text NOT NULL,
	`due_at` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`estimated_minutes` integer DEFAULT 60 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
