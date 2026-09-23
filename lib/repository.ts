/**
 * All database access for projects, runs and profiles. Every query is scoped to an `ownerId`,
 * so a record from another owner behaves exactly like one that does not exist.
 */
import { and, desc, eq, type AnyColumn } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, researchRuns, runProfiles, stageResults } from "@/db/schema";
import { ApiError, parseJson } from "./http";
import { BUILT_IN_PROFILES, getBuiltInProfile } from "./run-profiles";
import type { ToolRecord } from "./claim-verification";
import type { ProblemSpec, RunProfile, StageOutput, Usage } from "./research-types";

export type Project = ProblemSpec & { id: string; createdAt: number; updatedAt: number };

const owned = (table: { id: AnyColumn; ownerId: AnyColumn }, id: string, ownerId: string) =>
  and(eq(table.id, id), eq(table.ownerId, ownerId));

// ---------------------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------------------

export function serializeProject(row: typeof projects.$inferSelect): Project {
  return {
    id: row.id,
    title: row.title,
    field: row.field,
    statement: row.statement,
    definitions: parseJson(row.definitionsJson, []),
    assumptions: parseJson(row.assumptionsJson, []),
    knownResults: parseJson(row.knownResultsJson, []),
    bounds: row.boundsJson === "{}" ? undefined : parseJson(row.boundsJson, undefined),
    mode: row.mode as ProblemSpec["mode"],
    existingProof: row.existingProof ?? undefined,
    userSources: parseJson(row.userSourcesJson, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The columns shared by creating and updating a project. */
function projectColumns(spec: ProblemSpec) {
  return {
    title: spec.title,
    field: spec.field,
    statement: spec.statement,
    definitionsJson: JSON.stringify(spec.definitions),
    assumptionsJson: JSON.stringify(spec.assumptions),
    knownResultsJson: JSON.stringify(spec.knownResults),
    boundsJson: spec.bounds ? JSON.stringify(spec.bounds) : "{}",
    mode: spec.mode,
    existingProof: spec.existingProof ?? null,
    userSourcesJson: JSON.stringify(spec.userSources),
  };
}

export function getOwnedProject(ownerId: string, id: string) {
  const [row] = getDb()
    .select()
    .from(projects)
    .where(owned(projects, id, ownerId))
    .limit(1)
    .all();
  if (!row) throw new ApiError(404, "Research file not found.");
  return row;
}

export function listOwnedProjects(ownerId: string): Project[] {
  const rows = getDb()
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.updatedAt))
    .all();
  return rows.map(serializeProject);
}

export function createProject(ownerId: string, spec: ProblemSpec): Project {
  const now = Date.now();
  const row = getDb()
    .insert(projects)
    .values({ id: crypto.randomUUID(), ownerId, ...projectColumns(spec), createdAt: now, updatedAt: now })
    .returning()
    .get();
  return serializeProject(row);
}

export function updateProject(ownerId: string, id: string, spec: ProblemSpec): Project {
  getOwnedProject(ownerId, id);
  const row = getDb()
    .update(projects)
    .set({ ...projectColumns(spec), updatedAt: Date.now() })
    .where(owned(projects, id, ownerId))
    .returning()
    .get();
  return serializeProject(row);
}

export function deleteProject(ownerId: string, id: string) {
  getDb()
    .delete(projects)
    .where(owned(projects, id, ownerId))
    .run();
}

// ---------------------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------------------

export function getOwnedRun(ownerId: string, id: string) {
  const [row] = getDb()
    .select()
    .from(researchRuns)
    .where(owned(researchRuns, id, ownerId))
    .limit(1)
    .all();
  if (!row) throw new ApiError(404, "Research run not found.");
  return row;
}

/** A lightweight listing (the UI only needs to know which run belongs to which project). */
export function listOwnedRuns(ownerId: string) {
  return getDb()
    .select({
      id: researchRuns.id,
      projectId: researchRuns.projectId,
      status: researchRuns.status,
      updatedAt: researchRuns.updatedAt,
    })
    .from(researchRuns)
    .where(eq(researchRuns.ownerId, ownerId))
    .orderBy(desc(researchRuns.updatedAt))
    .all();
}

export function createRun(ownerId: string, projectId: string, profileId: string) {
  getOwnedProject(ownerId, projectId);
  const profile = findProfile(ownerId, profileId);
  if (!profile) throw new ApiError(400, "Unknown run profile");

  const now = Date.now();
  const id = crypto.randomUUID();
  getDb()
    .insert(researchRuns)
    .values({
      id,
      ownerId,
      projectId,
      // The profile is copied into the run, so later edits to a saved profile never change a run in flight.
      profileSnapshotJson: JSON.stringify(profile),
      status: "queued",
      currentStage: 0,
      cancelRequested: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return { id, projectId, status: "queued", currentStage: 0, profileSnapshot: profile };
}

export function cancelRun(ownerId: string, id: string) {
  getOwnedRun(ownerId, id);
  getDb()
    .update(researchRuns)
    .set({ cancelRequested: true, status: "cancelled", updatedAt: Date.now() })
    .where(owned(researchRuns, id, ownerId))
    .run();
  return { runId: id, status: "cancelled" };
}

export function getRunBundle(ownerId: string, id: string) {
  const { profileSnapshotJson, ...run } = getOwnedRun(ownerId, id);
  const project = serializeProject(getOwnedProject(ownerId, run.projectId));
  const results = getDb()
    .select()
    .from(stageResults)
    .where(eq(stageResults.runId, id))
    .orderBy(stageResults.createdAt)
    .all();

  return {
    run: { ...run, profileSnapshot: parseJson<RunProfile>(profileSnapshotJson, {} as RunProfile) },
    project,
    results: results.map((row) => ({
      ...row,
      output: row.outputJson ? parseJson<StageOutput | null>(row.outputJson, null) : null,
      usage: parseJson<Partial<Usage>>(row.usageJson, {}),
      toolRecords: parseJson<ToolRecord[]>(row.toolRecordsJson, []),
      error: row.errorJson
        ? parseJson<{ code?: string; message?: string } | null>(row.errorJson, null)
        : null,
    })),
  };
}

// ---------------------------------------------------------------------------------------
// Run profiles (built-ins plus the owner's saved profiles)
// ---------------------------------------------------------------------------------------

export function listProfiles(ownerId: string): RunProfile[] {
  const saved = getDb()
    .select()
    .from(runProfiles)
    .where(eq(runProfiles.ownerId, ownerId))
    .orderBy(desc(runProfiles.updatedAt))
    .all();
  return [
    ...Object.values(BUILT_IN_PROFILES),
    ...saved.map((row) => parseJson(row.configJson, {} as RunProfile)),
  ];
}

export function findProfile(ownerId: string, id: string): RunProfile | null {
  const builtIn = getBuiltInProfile(id);
  if (builtIn) return builtIn;
  const [saved] = getDb()
    .select()
    .from(runProfiles)
    .where(owned(runProfiles, id, ownerId))
    .limit(1)
    .all();
  return saved ? parseJson<RunProfile | null>(saved.configJson, null) : null;
}

type ProfileInput = Omit<RunProfile, "id">;

export function createProfile(ownerId: string, input: ProfileInput): RunProfile {
  const profile = { ...input, id: crypto.randomUUID() };
  const now = Date.now();
  getDb()
    .insert(runProfiles)
    .values({
      id: profile.id,
      ownerId,
      name: profile.name,
      configJson: JSON.stringify(profile),
      builtIn: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return profile;
}

export function updateProfile(ownerId: string, id: string, input: ProfileInput): RunProfile {
  const profile = { ...input, id };
  const row = getDb()
    .update(runProfiles)
    .set({ name: profile.name, configJson: JSON.stringify(profile), updatedAt: Date.now() })
    .where(and(owned(runProfiles, id, ownerId), eq(runProfiles.builtIn, false)))
    .returning()
    .get();
  if (!row) throw new ApiError(404, "Saved profile not found.");
  return profile;
}

export function deleteProfile(ownerId: string, id: string) {
  getDb()
    .delete(runProfiles)
    .where(and(owned(runProfiles, id, ownerId), eq(runProfiles.builtIn, false)))
    .run();
}
