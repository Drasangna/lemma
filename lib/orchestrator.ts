/**
 * Runs the research pipeline one stage at a time.
 *
 * Invariants (see IMPLEMENTATION_HANDOFF.md): a stage is validated and saved before the run
 * advances; nothing is ever retried or rerouted automatically; a failed attempt is kept.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { claims, evidence, researchRuns, stageResults } from "@/db/schema";
import { collectEvidenceIds, verifyClaims, type ToolRecord } from "./claim-verification";
import { ApiError, parseJson } from "./http";
import { getProvider, ProviderError, type ProviderResponse } from "./providers";
import { getOwnedProject, getOwnedRun, serializeProject } from "./repository";
import { stageIds, type ModelRef, type RunProfile, type StageId, type StageOutput } from "./research-types";
import { stageInput, stageInstructions } from "./stage-prompts";
import { runStageTools } from "./tools";

const PROMPT_VERSION = "lemma-v1";
const PROVIDER_ID = "openrouter";
const MAX_DEEP_PASS_TOKENS = 5000;

// ---------------------------------------------------------------------------------------
// Reading history
// ---------------------------------------------------------------------------------------

type StageRow = typeof stageResults.$inferSelect;

/** Completed, non-deep results in order: this is the context every later stage receives. */
function priorResults(rows: StageRow[]) {
  return rows
    .filter((row) => row.status === "completed" && !row.isDeepPass && row.outputJson)
    .map((row) => ({ stage: row.stage, output: parseJson<StageOutput>(row.outputJson!, {} as StageOutput) }));
}

/** Evidence ids from every tool run so far in this run (recorded by Lemma, never by a model). */
function recordedToolEvidence(rows: StageRow[], current: ToolRecord[]) {
  const earlier = rows.flatMap((row) => parseJson<ToolRecord[]>(row.toolRecordsJson, []));
  return collectEvidenceIds([...earlier, ...current]);
}

// ---------------------------------------------------------------------------------------
// Writing results (each function is one atomic transaction)
// ---------------------------------------------------------------------------------------

type Usage = ProviderResponse["usage"];

const usageIncrements = (usage: Usage) => ({
  inputTokens: sql`${researchRuns.inputTokens} + ${usage.inputTokens}`,
  outputTokens: sql`${researchRuns.outputTokens} + ${usage.outputTokens}`,
  reasoningTokens: sql`${researchRuns.reasoningTokens} + ${usage.reasoningTokens}`,
  cachedTokens: sql`${researchRuns.cachedTokens} + ${usage.cachedTokens}`,
});

type CompletedStage = {
  runId: string;
  stage: StageId;
  attempt: number;
  ref: ModelRef;
  response: ProviderResponse;
  output: StageOutput;
  tools: ToolRecord[];
  isDeepPass: boolean;
  /** Set for normal stages: advance the run to this index and status. */
  advanceTo?: { stageIndex: number };
};

function saveCompletedStage(stage: CompletedStage) {
  return getDb().transaction((tx) => {
    const stageResultId = crypto.randomUUID();
    tx.insert(stageResults)
      .values({
        id: stageResultId,
        runId: stage.runId,
        stage: stage.stage,
        attempt: stage.attempt,
        provider: PROVIDER_ID,
        requestedModel: stage.ref.model,
        returnedModel: stage.response.returnedModel,
        reasoning: stage.ref.reasoning,
        maxOutputTokens: stage.ref.maxOutputTokens,
        status: "completed",
        outputJson: JSON.stringify(stage.output),
        providerResponseId: stage.response.providerResponseId,
        usageJson: JSON.stringify(stage.response.usage),
        toolRecordsJson: JSON.stringify(stage.tools),
        promptVersion: PROMPT_VERSION,
        isDeepPass: stage.isDeepPass,
        createdAt: Date.now(),
      })
      .run();

    // Normalized copies of the claims and artifacts, for auditing.
    const claimRows = stage.output.claims.map((claim) => ({ id: crypto.randomUUID(), claim }));
    if (claimRows.length) {
      tx.insert(claims)
        .values(
          claimRows.map(({ id, claim }) => ({
            id,
            runId: stage.runId,
            stageResultId,
            text: claim.text,
            kind: claim.kind,
            verificationStatus: claim.verificationStatus,
            warningsJson: JSON.stringify(claim.warnings),
          })),
        )
        .run();
    }
    const evidenceRows = [
      ...claimRows.flatMap(({ id, claim }) =>
        claim.evidenceRefs.map((ref) => ({ claimId: id, type: "reference", label: ref, metadataJson: "{}" })),
      ),
      ...stage.output.artifacts.map((artifact) => ({
        claimId: null,
        type: artifact.type,
        label: artifact.title,
        metadataJson: JSON.stringify({ artifactId: artifact.id, ...artifact.metadata }),
      })),
    ];
    if (evidenceRows.length) {
      tx.insert(evidence)
        .values(
          evidenceRows.map((row) => ({ id: crypto.randomUUID(), runId: stage.runId, stageResultId, ...row })),
        )
        .run();
    }

    // Update the run in the same transaction, so "stage saved" and "run advanced" cannot diverge.
    const set = { ...usageIncrements(stage.response.usage), updatedAt: Date.now() };
    if (!stage.advanceTo) {
      tx.update(researchRuns).set(set).where(eq(researchRuns.id, stage.runId)).run();
      return { stageResultId, status: undefined };
    }
    const cancelRequested = tx
      .select({ v: researchRuns.cancelRequested })
      .from(researchRuns)
      .where(eq(researchRuns.id, stage.runId))
      .get()?.v;
    const status = cancelRequested
      ? "cancelled"
      : stage.advanceTo.stageIndex >= stageIds.length
        ? "completed"
        : "paused";
    tx.update(researchRuns)
      .set({ ...set, status, currentStage: stage.advanceTo.stageIndex })
      .where(eq(researchRuns.id, stage.runId))
      .run();
    return { stageResultId, status };
  });
}

function saveFailedStage(
  runId: string,
  stage: StageId,
  attempt: number,
  ref: ModelRef,
  tools: ToolRecord[],
  detail: object,
) {
  getDb().transaction((tx) => {
    tx.insert(stageResults)
      .values({
        id: crypto.randomUUID(),
        runId,
        stage,
        attempt,
        provider: PROVIDER_ID,
        requestedModel: ref.model,
        reasoning: ref.reasoning,
        maxOutputTokens: ref.maxOutputTokens,
        status: "failed",
        usageJson: "{}",
        toolRecordsJson: JSON.stringify(tools),
        errorJson: JSON.stringify(detail),
        promptVersion: PROMPT_VERSION,
        isDeepPass: false,
        createdAt: Date.now(),
      })
      .run();
    tx.update(researchRuns)
      .set({ status: "failed", updatedAt: Date.now() })
      .where(eq(researchRuns.id, runId))
      .run();
  });
}

// ---------------------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------------------

/** Runs the run's next stage. `override` lets the researcher explicitly pick a different model. */
export async function advanceRun(ownerId: string, runId: string, override: Partial<ModelRef> = {}) {
  const run = getOwnedRun(ownerId, runId);
  if (run.cancelRequested || run.status === "cancelled")
    throw new ApiError(409, "This run has been cancelled.");
  if (run.status === "completed") throw new ApiError(409, "This run is already complete.");

  const stage = stageIds[run.currentStage];
  if (!stage) throw new ApiError(409, "No remaining stage.");

  const profile = parseJson<RunProfile>(run.profileSnapshotJson, {} as RunProfile);
  const ref = { ...profile.stages[stage], ...override } as ModelRef;
  if (!ref.model) throw new ApiError(400, "The selected profile has no model for this stage.");
  if (run.outputTokens + ref.maxOutputTokens > profile.totalOutputLimit) {
    throw new ApiError(
      409,
      "The run output limit would be exceeded. Increase the saved profile limit explicitly to continue.",
    );
  }

  const project = serializeProject(getOwnedProject(ownerId, run.projectId));
  const history = getDb()
    .select()
    .from(stageResults)
    .where(eq(stageResults.runId, runId))
    .orderBy(stageResults.createdAt)
    .all();
  const attempt = 1 + history.filter((row) => row.stage === stage && !row.isDeepPass).length;

  const tools = await runStageTools(stage, project);
  getDb()
    .update(researchRuns)
    .set({ status: "running", updatedAt: Date.now() })
    .where(eq(researchRuns.id, runId))
    .run();

  try {
    const response = await getProvider().generateStructured({
      model: ref.model,
      reasoning: ref.reasoning,
      maxOutputTokens: ref.maxOutputTokens,
      instructions: stageInstructions(stage, project.mode),
      input: stageInput(stage, project, priorResults(history), tools),
    });
    const output = verifyClaims(response.output, recordedToolEvidence(history, tools));
    const saved = saveCompletedStage({
      runId,
      stage,
      attempt,
      ref,
      response,
      output,
      tools,
      isDeepPass: false,
      advanceTo: { stageIndex: run.currentStage + 1 },
    });
    return {
      stage,
      status: saved.status,
      stageResultId: saved.stageResultId,
      result: { ...response, output },
    };
  } catch (error) {
    const detail =
      error instanceof ProviderError
        ? { provider: error.provider, code: error.code, message: error.message, retryable: error.retryable }
        : {
            code: "unexpected",
            message: error instanceof Error ? error.message : "Unexpected stage failure",
            retryable: false,
          };
    saveFailedStage(runId, stage, attempt, ref, tools, detail);
    throw new ApiError(error instanceof ProviderError ? error.status : 500, detail.message, detail);
  }
}

/**
 * A manually approved, more expensive second look at proofs or critique. It is saved next to the
 * normal result (never over it) and does not move the run forward.
 */
export async function deepenStage(ownerId: string, runId: string, stage: StageId, ref: ModelRef) {
  if (stage !== "proofs" && stage !== "critique")
    throw new ApiError(400, "Only proof and critique stages can receive a deep pass.");
  if (ref.maxOutputTokens > MAX_DEEP_PASS_TOKENS)
    throw new ApiError(400, "Deep passes are limited to 5,000 output tokens.");

  const run = getOwnedRun(ownerId, runId);
  const project = serializeProject(getOwnedProject(ownerId, run.projectId));
  const history = getDb()
    .select()
    .from(stageResults)
    .where(eq(stageResults.runId, runId))
    .orderBy(stageResults.createdAt)
    .all();

  try {
    const response = await getProvider().generateStructured({
      model: ref.model,
      reasoning: ref.reasoning,
      maxOutputTokens: ref.maxOutputTokens,
      instructions: `${stageInstructions(stage, project.mode)}\nThis is a manually approved deep pass. Critically improve the earlier result without hiding it.`,
      input: stageInput(stage, project, priorResults(history), []),
    });
    const output = verifyClaims(response.output, recordedToolEvidence(history, []));
    const { stageResultId } = saveCompletedStage({
      runId,
      stage,
      attempt: 1,
      ref,
      response,
      output,
      tools: [],
      isDeepPass: true,
    });
    return { stageResultId, result: { ...response, output } };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw new ApiError(error.status, error.message, {
        provider: error.provider,
        code: error.code,
        retryable: error.retryable,
      });
    }
    throw error;
  }
}
