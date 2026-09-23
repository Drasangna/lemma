import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), title: text("title").notNull(),
  field: text("field").notNull().default("combinatorics"), statement: text("statement").notNull(),
  definitionsJson: text("definitions_json").notNull().default("[]"), assumptionsJson: text("assumptions_json").notNull().default("[]"),
  knownResultsJson: text("known_results_json").notNull().default("[]"), boundsJson: text("bounds_json").notNull().default("{}"),
  mode: text("mode").notNull().default("prove"), existingProof: text("existing_proof"),
  userSourcesJson: text("user_sources_json").notNull().default("[]"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_projects_owner_updated").on(table.ownerId, table.updatedAt)]);

export const runProfiles = sqliteTable("run_profiles", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), name: text("name").notNull(), configJson: text("config_json").notNull(),
  builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("idx_profiles_owner_name").on(table.ownerId, table.name)]);

export const researchRuns = sqliteTable("research_runs", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), projectId: text("project_id").notNull().references(() => projects.id),
  profileSnapshotJson: text("profile_snapshot_json").notNull(), status: text("status").notNull().default("queued"), currentStage: integer("current_stage").notNull().default(0),
  cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false), inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0), reasoningTokens: integer("reasoning_tokens").notNull().default(0), cachedTokens: integer("cached_tokens").notNull().default(0),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (table) => [index("idx_runs_owner_project").on(table.ownerId, table.projectId), index("idx_runs_status_updated").on(table.status, table.updatedAt)]);

export const stageResults = sqliteTable("stage_results", {
  id: text("id").primaryKey(), runId: text("run_id").notNull().references(() => researchRuns.id), stage: text("stage").notNull(), attempt: integer("attempt").notNull().default(1),
  provider: text("provider").notNull(), requestedModel: text("requested_model").notNull(), returnedModel: text("returned_model"), reasoning: text("reasoning").notNull(),
  maxOutputTokens: integer("max_output_tokens").notNull(), status: text("status").notNull(), outputJson: text("output_json"), providerResponseId: text("provider_response_id"),
  usageJson: text("usage_json").notNull().default("{}"), toolRecordsJson: text("tool_records_json").notNull().default("[]"), errorJson: text("error_json"),
  promptVersion: text("prompt_version").notNull(), isDeepPass: integer("is_deep_pass", { mode: "boolean" }).notNull().default(false), createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_stage_results_run_stage").on(table.runId, table.stage, table.createdAt)]);

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(), runId: text("run_id").notNull().references(() => researchRuns.id), stageResultId: text("stage_result_id").notNull().references(() => stageResults.id),
  text: text("text").notNull(), kind: text("kind").notNull(), verificationStatus: text("verification_status").notNull(), warningsJson: text("warnings_json").notNull().default("[]"),
}, (table) => [index("idx_claims_run").on(table.runId)]);

export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(), runId: text("run_id").notNull().references(() => researchRuns.id), stageResultId: text("stage_result_id").notNull().references(() => stageResults.id),
  claimId: text("claim_id").references(() => claims.id), type: text("type").notNull(), label: text("label").notNull(), metadataJson: text("metadata_json").notNull().default("{}"),
}, (table) => [index("idx_evidence_run_claim").on(table.runId, table.claimId)]);

export const idempotencyRecords = sqliteTable("idempotency_records", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), key: text("key").notNull(), operation: text("operation").notNull(), responseJson: text("response_json").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("idx_idempotency_owner_key_operation").on(table.ownerId, table.key, table.operation)]);

export const literatureCache = sqliteTable("literature_cache", {
  id: text("id").primaryKey(), queryKey: text("query_key").notNull(), resultsJson: text("results_json").notNull(),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
}, (table) => [uniqueIndex("idx_literature_cache_query").on(table.queryKey), index("idx_literature_cache_expiry").on(table.expiresAt)]);
