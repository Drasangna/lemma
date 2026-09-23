import { DEEPSEEK_ECONOMY, OPENAI_ECONOMY } from "./models";
import { stageIds, type ModelRef, type RunProfile, type StageId } from "./research-types";

export const DEFAULT_PROFILE_ID = "deepseek-economy";

const economy = (model: string): ModelRef => ({ model, reasoning: "low", maxOutputTokens: 3000 });
const sameModelEverywhere = (ref: ModelRef) =>
  Object.fromEntries(stageIds.map((stage) => [stage, { ...ref }])) as Record<StageId, ModelRef>;
const profile = (id: string, name: string, stages: Record<StageId, ModelRef>): RunProfile => ({
  id,
  name,
  totalOutputLimit: 18_000,
  stages,
});

const deepseek = economy(DEEPSEEK_ECONOMY);
const openai = economy(OPENAI_ECONOMY);

export const BUILT_IN_PROFILES: Record<string, RunProfile> = {
  "deepseek-economy": profile("deepseek-economy", "DeepSeek Economy", sameModelEverywhere(deepseek)),
  "openai-economy": profile("openai-economy", "OpenAI Economy", sameModelEverywhere(openai)),
  "mixed-economy": profile("mixed-economy", "Mixed Economy", {
    normalize: deepseek,
    evidence: deepseek,
    lemmas: openai,
    proofs: openai,
    critique: openai,
    synthesis: deepseek,
  }),
};

export function getBuiltInProfile(id: string): RunProfile | null {
  return BUILT_IN_PROFILES[id] ? structuredClone(BUILT_IN_PROFILES[id]) : null;
}
