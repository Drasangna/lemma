import { stageOutputJsonSchema } from "../research-types";
import { extractOutputText, fetchWithTimeout, normalizeHttpError, normalizeUsage, parseStageOutput } from "./shared";
import { ProviderError, type GenerateStructuredRequest, type ModelProviderAdapter, type ProviderResponse, type ToolResult } from "./types";

const CONFIGURED_MODELS = [
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", deep: false },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", deep: false },
  { id: "openai/gpt-4o", label: "GPT-4o", deep: true },
  { id: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner", deep: true },
] as const;

const REASONING_HINT: Record<string, string> = {
  none: "",
  low: "Reason briefly before answering.",
  medium: "Reason carefully through the problem before answering.",
  high: "Reason thoroughly and critically through the problem, checking your own work, before answering.",
};

export class OpenRouterAdapter implements ModelProviderAdapter {
  readonly providerId = "openrouter" as const;
  readonly capabilities = { structuredOutput: true, functionTools: true, reasoningControls: false, streaming: true, usageReporting: true };
  constructor(private apiKey?: string) {}
  configuredModels() { return this.apiKey ? CONFIGURED_MODELS.map((m) => ({ ...m })) : []; }
  async generateStructured(request: GenerateStructuredRequest): Promise<ProviderResponse> {
    if (!this.apiKey) throw new ProviderError("openrouter", "not_configured", "OpenRouter is not configured for this deployment.", false, 503);
    const hint = REASONING_HINT[request.reasoning] ?? "";
    const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: hint ? `${request.instructions}\n\n${hint}` : request.instructions },
          { role: "user", content: request.input },
        ],
        max_tokens: request.maxOutputTokens,
        response_format: { type: "json_schema", json_schema: { name: request.schemaName ?? "research_stage", strict: false, schema: stageOutputJsonSchema } },
      }),
    }, "openrouter", request.signal);
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const error = payload.error as { message?: string } | undefined;
    if (!response.ok) throw normalizeHttpError("openrouter", response.status, error?.message ?? "OpenRouter request failed");
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = (choices[0] ?? {}) as Record<string, unknown>;
    return {
      output: parseStageOutput("openrouter", extractOutputText(payload)),
      providerResponseId: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
      returnedModel: typeof payload.model === "string" ? payload.model : request.model,
      finishState: firstChoice.finish_reason === "stop" ? "completed" : "incomplete",
      usage: normalizeUsage(payload.usage),
      rawToolCalls: [],
    };
  }
  continueWithToolResults(request: GenerateStructuredRequest, previous: ProviderResponse, results: ToolResult[]) {
    return this.generateStructured({ ...request, input: `${request.input}\n\nTool results:\n${JSON.stringify(results)}\n\nPrevious partial result:\n${JSON.stringify(previous.output)}` });
  }
}
