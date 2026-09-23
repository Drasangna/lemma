import { MODELS } from "../models";
import { stageOutputJsonSchema, stageOutputSchema, type StageOutput, type Usage } from "../research-types";
import {
  ProviderError,
  type GenerateStructuredRequest,
  type ModelProviderAdapter,
  type ProviderErrorCode,
  type ProviderResponse,
} from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 55_000;
const PROVIDER_ID = "openrouter";

/** OpenRouter has no portable reasoning-effort parameter, so effort is requested in the prompt. */
const REASONING_HINT: Record<GenerateStructuredRequest["reasoning"], string> = {
  none: "",
  low: "Reason briefly before answering.",
  medium: "Reason carefully through the problem before answering.",
  high: "Reason thoroughly and critically through the problem, checking your own work, before answering.",
};

// ---------------------------------------------------------------------------------------
// Response helpers (exported for tests)
// ---------------------------------------------------------------------------------------

type Json = Record<string, unknown>;
const asRecord = (value: unknown): Json =>
  value !== null && typeof value === "object" ? (value as Json) : {};
const asNumber = (value: unknown) => Number(value ?? 0);

/** Pulls the assistant text out of a chat-completions response. */
export function extractOutputText(response: unknown): string {
  const choices = asRecord(response).choices;
  const message = asRecord(asRecord(Array.isArray(choices) ? choices[0] : undefined).message);
  return typeof message.content === "string" ? message.content : "";
}

export function parseStageOutput(provider: string, text: string): StageOutput {
  try {
    return stageOutputSchema.parse(JSON.parse(text));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid JSON";
    throw new ProviderError(
      provider,
      "invalid_output",
      `Provider returned an invalid research result: ${reason}`,
      true,
      422,
    );
  }
}

export function normalizeUsage(raw: unknown): Usage {
  const usage = asRecord(raw);
  const inputTokens = asNumber(usage.prompt_tokens);
  const outputTokens = asNumber(usage.completion_tokens);
  return {
    inputTokens,
    outputTokens,
    reasoningTokens: asNumber(asRecord(usage.completion_tokens_details).reasoning_tokens),
    cachedTokens: asNumber(asRecord(usage.prompt_tokens_details).cached_tokens),
    totalTokens: asNumber(usage.total_tokens ?? inputTokens + outputTokens),
  };
}

export function normalizeHttpError(provider: string, status: number, message: string): ProviderError {
  let code: ProviderErrorCode = "upstream";
  let retryable = status >= 500 || status === 408;
  if (status === 401 || status === 403) {
    code = "authentication";
    retryable = false;
  } else if (status === 429) {
    code = message.toLowerCase().includes("quota") ? "quota" : "rate_limit";
    retryable = code === "rate_limit";
  } else if (status === 408) {
    code = "timeout";
  }
  return new ProviderError(provider, code, message || `${provider} request failed`, retryable, status);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ProviderError(PROVIDER_ID, "timeout", `${PROVIDER_ID} request timed out`, true, 408);
    }
    throw new ProviderError(
      PROVIDER_ID,
      "upstream",
      error instanceof Error ? error.message : "Network error",
      true,
    );
  }
}

// ---------------------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------------------

export class OpenRouterAdapter implements ModelProviderAdapter {
  readonly providerId = PROVIDER_ID;

  constructor(private apiKey?: string) {}

  configuredModels() {
    return this.apiKey ? MODELS.map((model) => ({ ...model })) : [];
  }

  async generateStructured(request: GenerateStructuredRequest): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new ProviderError(
        PROVIDER_ID,
        "not_configured",
        "OpenRouter is not configured. Set OPENROUTER_API_KEY.",
        false,
        503,
      );
    }

    const hint = REASONING_HINT[request.reasoning];
    const response = await fetchWithTimeout(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxOutputTokens,
        messages: [
          { role: "system", content: hint ? `${request.instructions}\n\n${hint}` : request.instructions },
          { role: "user", content: request.input },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "research_stage", strict: false, schema: stageOutputJsonSchema },
        },
      }),
    });

    const payload = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      const message = asRecord(payload.error).message;
      throw normalizeHttpError(
        PROVIDER_ID,
        response.status,
        typeof message === "string" ? message : "OpenRouter request failed",
      );
    }

    const firstChoice = asRecord(Array.isArray(payload.choices) ? payload.choices[0] : undefined);
    return {
      output: parseStageOutput(PROVIDER_ID, extractOutputText(payload)),
      providerResponseId: typeof payload.id === "string" ? payload.id : crypto.randomUUID(),
      returnedModel: typeof payload.model === "string" ? payload.model : request.model,
      finishState: firstChoice.finish_reason === "stop" ? "completed" : "incomplete",
      usage: normalizeUsage(payload.usage),
    };
  }
}
