CREATE TABLE `profile_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`self_assessment` text DEFAULT '' NOT NULL,
	`goals` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `profile_suggestions` ADD `goal_relation` text DEFAULT '' NOT NULL;
