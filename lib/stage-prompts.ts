/** Prompt text for each pipeline stage, in "prove" mode and (where it differs) "expand" mode. */
import { verificationStatuses, type ProblemSpec, type StageId, type StageOutput } from "./research-types";

type Mode = ProblemSpec["mode"];

const BASE = `You are one role in an auditable mathematical research pipeline. Return only the requested JSON structure. Never label an argument formally proved. Model agreement is not verification. Use only these claim labels: ${verificationStatuses.join(", ")}. A user-supplied citation is unverified unless it matches a metadata-verified result supplied by the literature tool. Every source-supported or computation-supported claim must cite the exact evidence id in evidenceRefs. Preserve uncertainty and expose gaps.`;

/** Role text for "prove" mode: starting from an open statement. */
const ROLES: Record<StageId, string> = {
  normalize:
    "Act as a mathematical problem editor. Clarify notation and dependencies without strengthening the claim.",
  evidence:
    "Act as an evidence analyst. Connect only supplied literature metadata and deterministic experiments to claims. Do not invent citations.",
  lemmas:
    "Act as a conjecture and lemma generator. Propose useful intermediate statements, and label them unverified unless evidence directly supports them.",
  proofs:
    "Act as a proof strategist. Produce exactly two materially different approaches, with explicit gaps and dependencies.",
  critique:
    "Act as an adversarial referee. Seek counterexamples, circular reasoning, hidden assumptions, and unsupported uniqueness or novelty claims.",
  synthesis:
    "Act as a research editor. Assemble a dossier that preserves disagreements, negative results, and unresolved questions.",
};

/** "Expand" mode starts from a researcher-supplied proof. Stages not listed here reuse ROLES. */
const EXPAND_ROLES: Partial<Record<StageId, string>> = {
  normalize:
    "Act as a mathematical problem editor. Clarify notation and dependencies without strengthening the claim. Treat the researcher-supplied existing proof as given context to formalize, not something to derive or re-argue.",
  evidence:
    "Act as an evidence analyst. Connect only supplied literature metadata and deterministic experiments to claims. Search for sources for and around the existing supplied proof/result, not toward proving an open conjecture. Do not invent citations.",
  lemmas:
    "Act as a conjecture and lemma generator. Given the existing proof, identify generalizations, corollaries, and related conjectures it suggests. Label them unverified unless evidence directly supports them.",
  proofs:
    "Act as a proof strategist. Attempt the identified generalizations/corollaries and/or find gaps in the existing supplied proof, with explicit gaps and dependencies. Do not restate the original proof as new work.",
};

export function stageInstructions(stage: StageId, mode: Mode = "prove") {
  const role = (mode === "expand" && EXPAND_ROLES[stage]) || ROLES[stage];
  return `${BASE}\n\n${role}\nPrompt version: lemma-${stage}-v1.`;
}

/** The user-side message: the problem, everything earlier stages produced, and tool evidence. */
export function stageInput(
  stage: StageId,
  problem: ProblemSpec,
  priorResults: Array<{ stage: string; output: StageOutput }>,
  toolEvidence: unknown[],
) {
  const twoProofStrategies = stage === "proofs" && problem.mode !== "expand";
  return JSON.stringify(
    {
      task: stage,
      problem,
      priorResults,
      toolEvidence,
      requirements: {
        maximumClaims: 30,
        maximumSources: 12,
        proofStrategies: twoProofStrategies ? 2 : undefined,
      },
    },
    null,
    2,
  );
}
