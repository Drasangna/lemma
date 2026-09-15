CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`stage_result_id` text NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`verification_status` text NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage_result_id`) REFERENCES `stage_results`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_claims_run` ON `claims` (`run_id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`stage_result_id` text NOT NULL,
	`claim_id` text,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage_result_id`) REFERENCES `stage_results`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_run_claim` ON `evidence` (`run_id`,`claim_id`);--> statement-breakpoint
CREATE TABLE `idempotency_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`key` text NOT NULL,
	`operation` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_idempotency_owner_key_operation` ON `idempotency_records` (`owner_id`,`key`,`operation`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`field` text DEFAULT 'combinatorics' NOT NULL,
	`statement` text NOT NULL,
	`definitions_json` text DEFAULT '[]' NOT NULL,
	`assumptions_json` text DEFAULT '[]' NOT NULL,
	`known_results_json` text DEFAULT '[]' NOT NULL,
	`bounds_json` text DEFAULT '{}' NOT NULL,
	`user_sources_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_projects_owner_updated` ON `projects` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`profile_snapshot_json` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`current_stage` integer DEFAULT 0 NOT NULL,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`cached_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_runs_owner_project` ON `research_runs` (`owner_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_status_updated` ON `research_runs` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `run_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`config_json` text NOT NULL,
	`built_in` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_owner_name` ON `run_profiles` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `stage_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`stage` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`provider` text NOT NULL,
	`requested_model` text NOT NULL,
	`returned_model` text,
	`reasoning` text NOT NULL,
	`max_output_tokens` integer NOT NULL,
	`status` text NOT NULL,
	`output_json` text,
	`provider_response_id` text,
	`usage_json` text DEFAULT '{}' NOT NULL,
	`tool_records_json` text DEFAULT '[]' NOT NULL,
	`error_json` text,
	`prompt_version` text NOT NULL,
	`is_deep_pass` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `research_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_stage_results_run_stage` ON `stage_results` (`run_id`,`stage`,`created_at`);