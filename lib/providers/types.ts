import type { ReasoningLevel, StageOutput, Usage } from "../research-types";

export type ProviderCapabilities = { structuredOutput:boolean; functionTools:boolean; reasoningControls:boolean; streaming:boolean; usageReporting:boolean };
export type ToolResult = { callId:string; name:string; output:unknown };
export type GenerateStructuredRequest = { model:string; reasoning:ReasoningLevel; maxOutputTokens:number; instructions:string; input:string; schemaName?:string; signal?:AbortSignal };
export type ProviderResponse = { output:StageOutput; providerResponseId:string; returnedModel:string; finishState:"completed"|"incomplete"; usage:Usage; rawToolCalls:Array<{callId:string;name:string;arguments:unknown}> };
export type ProviderErrorCode = "not_configured"|"authentication"|"rate_limit"|"quota"|"timeout"|"content_filter"|"invalid_output"|"upstream";

export class ProviderError extends Error {
  constructor(public provider:string, public code:ProviderErrorCode, message:string, public retryable:boolean, public status=502){super(message);this.name="ProviderError"}
}

export interface ModelProviderAdapter {
  readonly providerId:string;
  readonly capabilities:ProviderCapabilities;
  configuredModels():Array<{id:string;label:string;deep:boolean}>;
  generateStructured(request:GenerateStructuredRequest):Promise<ProviderResponse>;
  continueWithToolResults(request:GenerateStructuredRequest, previous:ProviderResponse, results:ToolResult[]):Promise<ProviderResponse>;
}
