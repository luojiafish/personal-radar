CREATE TABLE `profile_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`normalized_value` text NOT NULL,
	`rationale` text NOT NULL,
	`evidence_count` integer NOT NULL,
	`evidence_start_date` text NOT NULL,
	`evidence_end_date` text NOT NULL,
	`confirmed_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_suggestions_kind_value_unique` ON `profile_suggestions` (`kind`,`normalized_value`);
--> statement-breakpoint
CREATE INDEX `profile_suggestions_confirmed_idx` ON `profile_suggestions` (`confirmed_at`);
