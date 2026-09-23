/** The OpenRouter models Lemma offers. Add or swap entries here; nothing else hardcodes model ids. */
export type ModelOption = {
  id: string;
  label: string;
  /** Deep models are only used for manual deep passes. */ deep: boolean;
};

export const DEEPSEEK_ECONOMY = "deepseek/deepseek-chat";
export const OPENAI_ECONOMY = "openai/gpt-4o-mini";

export const MODELS: readonly ModelOption[] = [
  { id: DEEPSEEK_ECONOMY, label: "DeepSeek Chat", deep: false },
  { id: OPENAI_ECONOMY, label: "GPT-4o mini", deep: false },
  { id: "openai/gpt-4o", label: "GPT-4o", deep: true },
  { id: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner", deep: true },
];
