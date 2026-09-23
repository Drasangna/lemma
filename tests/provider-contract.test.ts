/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { MODELS } from "../lib/models";
import {
  normalizeHttpError,
  normalizeUsage,
  OpenRouterAdapter,
  parseStageOutput,
} from "../lib/providers/openrouter";
import { ProviderError } from "../lib/providers/types";
import { stageOutputJsonSchema } from "../lib/research-types";

const validOutput = {
  summary: "A bounded result.",
  claims: [],
  artifacts: [],
  openQuestions: [],
  suggestedNextSteps: [],
};
const request = {
  model: "deepseek/deepseek-chat",
  reasoning: "high" as const,
  maxOutputTokens: 500,
  instructions: "SYSTEM",
  input: "INPUT",
};

let calls: Array<{ url: string; init: any }> = [];
function mockFetch(respond: () => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return respond();
  }) as typeof fetch;
}
const completion = (content: string, extra: object = {}) =>
  Response.json({
    id: "gen-1",
    model: "deepseek/deepseek-chat-v3",
    choices: [{ finish_reason: "stop", message: { content } }],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 7,
      prompt_tokens_details: { cached_tokens: 5 },
      completion_tokens_details: { reasoning_tokens: 2 },
    },
    ...extra,
  });

test("the adapter sends a structured chat-completions request", async () => {
  mockFetch(() => completion(JSON.stringify(validOutput)));
  await new OpenRouterAdapter("secret").generateStructured(request);

  const [{ url, init }] = calls;
  const body = JSON.parse(init.body);
  assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(init.headers.Authorization, "Bearer secret");
  assert.equal(body.model, request.model);
  assert.equal(body.max_tokens, 500);
  assert.match(body.messages[0].content, /^SYSTEM\n\nReason thoroughly/);
  assert.deepEqual(body.messages[1], { role: "user", content: "INPUT" });
  assert.deepEqual(body.response_format.json_schema.schema, stageOutputJsonSchema);
});

test("the adapter returns validated output, the returned model, and normalized usage", async () => {
  mockFetch(() => completion(JSON.stringify(validOutput)));
  const response = await new OpenRouterAdapter("secret").generateStructured(request);

  assert.deepEqual(response.output, validOutput);
  assert.equal(response.returnedModel, "deepseek/deepseek-chat-v3");
  assert.equal(response.providerResponseId, "gen-1");
  assert.equal(response.finishState, "completed");
  assert.deepEqual(response.usage, {
    inputTokens: 12,
    outputTokens: 7,
    reasoningTokens: 2,
    cachedTokens: 5,
    totalTokens: 19,
  });
});

test("the adapter makes no request and reports not_configured without an API key", async () => {
  mockFetch(() => completion("{}"));
  await assert.rejects(
    new OpenRouterAdapter(undefined).generateStructured(request),
    (error: ProviderError) => error.code === "not_configured",
  );
  assert.equal(calls.length, 0);
});

test("the adapter never retries: one failing call is exactly one request", async () => {
  mockFetch(() => Response.json({ error: { message: "rate limited" } }, { status: 429 }));
  await assert.rejects(
    new OpenRouterAdapter("secret").generateStructured(request),
    (error: ProviderError) => error.code === "rate_limit",
  );
  assert.equal(calls.length, 1);
});

test("the adapter rejects malformed model output instead of passing it on", async () => {
  mockFetch(() => completion("definitely not json"));
  await assert.rejects(
    new OpenRouterAdapter("secret").generateStructured(request),
    (error: ProviderError) => error.code === "invalid_output",
  );
});

test("network failures become retryable upstream errors", async () => {
  mockFetch(() => Promise.reject(new Error("connection reset")));
  await assert.rejects(
    new OpenRouterAdapter("secret").generateStructured(request),
    (error: ProviderError) => error.code === "upstream" && error.retryable,
  );
});

test("the adapter exposes exactly the reviewed models, and none without a key", () => {
  assert.deepEqual(
    new OpenRouterAdapter("k").configuredModels().map((m) => m.id),
    MODELS.map((m) => m.id),
  );
  assert.deepEqual(new OpenRouterAdapter(undefined).configuredModels(), []);
});

test("http errors map to auditable error codes", () => {
  assert.equal(normalizeHttpError("openrouter", 429, "quota exhausted").code, "quota");
  assert.equal(normalizeHttpError("openrouter", 429, "slow down").retryable, true);
  assert.equal(normalizeHttpError("openrouter", 401, "bad key").retryable, false);
  assert.equal(normalizeHttpError("openrouter", 503, "").retryable, true);
});

test("usage tolerates missing fields", () => {
  assert.deepEqual(normalizeUsage(undefined), {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
  });
});

test("malformed structured output is rejected", () => {
  assert.throws(() => parseStageOutput("openrouter", "not-json"), /invalid research result/i);
});
