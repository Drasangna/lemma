/**
 * The claim policy: a model may only label a claim "source-supported" or "computation-supported"
 * if it cites the id of evidence that Lemma's own tools actually recorded. Anything else is
 * downgraded to "unverified" with a warning. Model-authored artifacts never count as evidence.
 */
import type { StageOutput } from "./research-types";

export type ToolRecord = { name: string; output: unknown };
export type EvidenceIds = { sources: Set<string>; computations: Set<string> };

/** Name of the tool record that carries literature results (an array of sources with ids). */
export const LITERATURE_TOOL = "search_literature";

/** Collects the ids of evidence recorded by tools (this stage's and every earlier stage's). */
export function collectEvidenceIds(toolRecords: ToolRecord[]): EvidenceIds {
  const ids: EvidenceIds = { sources: new Set(), computations: new Set() };

  for (const { name, output } of toolRecords) {
    if (name === LITERATURE_TOOL) {
      if (!Array.isArray(output)) continue;
      for (const source of output) if (typeof source?.id === "string") ids.sources.add(source.id);
    } else if (typeof (output as { id?: unknown } | null)?.id === "string") {
      // Any other tool is a computation kernel; its result carries the id claims must cite.
      ids.computations.add((output as { id: string }).id);
    }
  }
  return ids;
}

export function verifyClaims(output: StageOutput, evidence: EvidenceIds): StageOutput {
  const claims = output.claims.map((claim) => {
    const supported =
      claim.verificationStatus === "source-supported"
        ? claim.evidenceRefs.some((ref) => evidence.sources.has(ref))
        : claim.verificationStatus === "computation-supported"
          ? claim.evidenceRefs.some((ref) => evidence.computations.has(ref))
          : true;
    if (supported) return claim;

    return {
      ...claim,
      verificationStatus: "unverified" as const,
      warnings: [
        ...claim.warnings,
        "Downgraded by Lemma: the claimed support did not reference a recorded source or computation.",
      ],
    };
  });
  return { ...output, claims };
}
