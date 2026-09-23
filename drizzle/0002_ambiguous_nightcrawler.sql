ALTER TABLE `projects` ADD `mode` text DEFAULT 'prove' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `existing_proof` text;