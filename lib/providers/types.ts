import type { ModelOption } from "../models";
import type { ReasoningLevel, StageOutput, Usage } from "../research-types";

export type GenerateStructuredRequest = {
  model: string;
  reasoning: ReasoningLevel;
  maxOutputTokens: number;
  instructions: string;
  input: string;
};

export type ProviderResponse = {
  output: StageOutput;
  providerResponseId: string;
  returnedModel: string;
  finishState: "completed" | "incomplete";
  usage: Usage;
};

export type ProviderErrorCode =
  "not_configured" | "authentication" | "rate_limit" | "quota" | "timeout" | "invalid_output" | "upstream";

/** A normalized model-call failure. `status` is the HTTP status the API should answer with. */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public code: ProviderErrorCode,
    message: string,
    public retryable: boolean,
    public status = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * The seam for adding another model gateway. An adapter turns one structured request into one
 * validated `StageOutput`; it must never retry or fall back to a different model on its own.
 */
export interface ModelProviderAdapter {
  readonly providerId: string;
  configuredModels(): ModelOption[];
  generateStructured(request: GenerateStructuredRequest): Promise<ProviderResponse>;
}
