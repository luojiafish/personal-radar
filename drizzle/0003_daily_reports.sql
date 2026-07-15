CREATE TABLE `daily_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_target_id` text NOT NULL,
	`report_date` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`watch_target_id`) REFERENCES `watch_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_reports_target_date_unique` ON `daily_reports` (`watch_target_id`,`report_date`);
--> statement-breakpoint
CREATE INDEX `daily_reports_date_idx` ON `daily_reports` (`report_date`);
--> statement-breakpoint
CREATE TABLE `daily_report_items` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_report_id` text NOT NULL,
	`saved_item_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`daily_report_id`) REFERENCES `daily_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`saved_item_id`) REFERENCES `saved_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_report_items_report_saved_unique` ON `daily_report_items` (`daily_report_id`,`saved_item_id`);
--> statement-breakpoint
CREATE INDEX `daily_report_items_report_idx` ON `daily_report_items` (`daily_report_id`);
