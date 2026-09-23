import type { StageId } from "@/lib/research-types";

export const STAGE_LABELS: Record<StageId, string> = {
  normalize: "Problem normalized",
  evidence: "Literature & experiments",
  lemmas: "Candidate lemmas",
  proofs: "Proof strategies",
  critique: "Adversarial critique",
  synthesis: "Dossier synthesis",
};

export const STAGE_NOTES: Record<StageId, string> = {
  normalize: "Definitions and assumptions",
  evidence: "Metadata plus bounded computation",
  lemmas: "Evidence-linked candidates",
  proofs: "Two independent approaches",
  critique: "Counterexamples and gaps",
  synthesis: "Audit-ready report",
};
