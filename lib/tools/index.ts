/**
 * Everything the evidence stage can run. Tools are deterministic and bounded: literature
 * metadata search plus any computation kernels that apply to the problem's field.
 */
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { literatureCache } from "@/db/schema";
import { LITERATURE_TOOL, type ToolRecord } from "../claim-verification";
import { parseJson } from "../http";
import { COMBINATORICS_FIELD_PATTERN, type ProblemSpec, type StageId } from "../research-types";
import { runCombinatoricsExperiment } from "./combinatorics";
import { searchLiterature, type LiteratureSource } from "./literature";

// ---------------------------------------------------------------------------------------
// Computation kernels: add an entry here to support a new field.
// ---------------------------------------------------------------------------------------

export type ComputationKernel = {
  id: string;
  appliesTo(problem: ProblemSpec): boolean;
  /** Returns a result whose `id` claims can cite, or null when the kernel has nothing to say. */
  run(problem: ProblemSpec): { id: string } | null;
};

export const computationKernels: ComputationKernel[] = [
  {
    id: "combinatorics-graph-kernel",
    appliesTo: (problem) => COMBINATORICS_FIELD_PATTERN.test(problem.field),
    run: (problem) => runCombinatoricsExperiment(problem.statement, problem.bounds?.maxVertices ?? 6),
  },
];

export const applicableKernels = (problem: ProblemSpec) =>
  computationKernels.filter((kernel) => kernel.appliesTo(problem));

// ---------------------------------------------------------------------------------------
// Literature search with a one-week cache (public metadata changes slowly)
// ---------------------------------------------------------------------------------------

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function cachedLiterature(problem: ProblemSpec): Promise<LiteratureSource[]> {
  const query = `${problem.title} ${problem.statement.slice(0, 400)}`;
  const queryKey = query.toLowerCase().replace(/\s+/g, " ").trim();
  const db = getDb();

  const [hit] = db
    .select()
    .from(literatureCache)
    .where(and(eq(literatureCache.queryKey, queryKey), gt(literatureCache.expiresAt, Date.now())))
    .limit(1)
    .all();
  if (hit) return parseJson(hit.resultsJson, []);

  const results = await searchLiterature(query, process.env.CROSSREF_MAILTO);
  const now = Date.now();
  const cached = { resultsJson: JSON.stringify(results), createdAt: now, expiresAt: now + CACHE_TTL_MS };
  db.insert(literatureCache)
    .values({ id: crypto.randomUUID(), queryKey, ...cached })
    .onConflictDoUpdate({ target: literatureCache.queryKey, set: cached })
    .run();
  return results;
}

// ---------------------------------------------------------------------------------------
// Entry point used by the orchestrator
// ---------------------------------------------------------------------------------------

/** Only the evidence stage runs tools. Every other stage reasons over what was already recorded. */
export async function runStageTools(stage: StageId, problem: ProblemSpec): Promise<ToolRecord[]> {
  if (stage !== "evidence") return [];

  const literature = await cachedLiterature(problem).catch((error) => ({
    error: error instanceof Error ? error.message : "Literature search failed",
  }));
  const experiments = applicableKernels(problem).flatMap((kernel) => {
    const output = kernel.run(problem);
    return output ? [{ name: kernel.id, output }] : [];
  });
  return [{ name: LITERATURE_TOOL, output: literature }, ...experiments];
}
