ALTER TABLE `sources` ADD `origin` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `sources_origin_idx` ON `sources` (`origin`);
--> statement-breakpoint
CREATE TABLE `site_login_statuses` (
	`origin` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`checked_at` text,
	`check_method` text,
	`detector_version` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_items` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_target_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`source_domain` text NOT NULL,
	`content_excerpt` text DEFAULT '' NOT NULL,
	`selected_text` text DEFAULT '' NOT NULL,
	`ai_summary` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`watch_target_id`) REFERENCES `watch_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_items_target_idx` ON `saved_items` (`watch_target_id`);
--> statement-breakpoint
CREATE INDEX `saved_items_created_idx` ON `saved_items` (`created_at`);
