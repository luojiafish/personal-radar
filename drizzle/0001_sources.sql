CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`watch_target_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`domain` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`watch_target_id`) REFERENCES `watch_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_target_url_unique` ON `sources` (`watch_target_id`,`url`);
--> statement-breakpoint
CREATE INDEX `sources_target_idx` ON `sources` (`watch_target_id`);
