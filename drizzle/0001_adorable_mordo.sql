CREATE TABLE `literature_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`query_key` text NOT NULL,
	`results_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_literature_cache_query` ON `literature_cache` (`query_key`);--> statement-breakpoint
CREATE INDEX `idx_literature_cache_expiry` ON `literature_cache` (`expires_at`);