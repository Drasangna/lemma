/**
 * Shared types and validation schemas. Everything the API accepts or a model returns is
 * validated here, so this is the file to read first when you want to know what data looks like.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------------------

/** The fixed investigation pipeline. Stage order is array order. */
export const stageIds = ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"] as const;
export const stageIdSchema = z.enum(stageIds);
export type StageId = (typeof stageIds)[number];

export const reasoningSchema = z.enum(["none", "low", "medium", "high"]);
export type ReasoningLevel = z.infer<typeof reasoningSchema>;

// ---------------------------------------------------------------------------------------
// Claim vocabulary (single source for Zod, the model's JSON schema, and prompts)
// ---------------------------------------------------------------------------------------

/** There is deliberately no "proved" status: Lemma never certifies a proof. */
export const verificationStatuses = [
  "source-supported",
  "computation-supported",
  "internally-checked",
  "contested",
  "unverified",
] as const;
export const claimKinds = ["fact", "observation", "lemma", "conjecture", "proof-step", "critique"] as const;
export const artifactTypes = [
  "source",
  "computation",
  "argument",
  "counterexample",
  "report-section",
] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

// ---------------------------------------------------------------------------------------
// Problem specification (what the researcher enters)
// ---------------------------------------------------------------------------------------

function isPublicHttps(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".local") || host === "::1" || host === "0.0.0.0") return false;
    if (/^(127|10)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    return !(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
  } catch {
    return false;
  }
}

/** Fields that get the bounded graph-theory computation kernel and the vertex-bounds inputs. */
export const COMBINATORICS_FIELD_PATTERN = /\b(combinatorics|graph)\b/i;

const shortText = z.string().trim().min(1).max(1_000);

export const problemSpecSchema = z.object({
  title: z.string().trim().min(3).max(160),
  field: z.string().trim().min(2).max(60).default("combinatorics"),
  statement: z.string().trim().min(10).max(12_000),
  definitions: z.array(shortText).max(30).default([]),
  assumptions: z.array(shortText).max(30).default([]),
  knownResults: z.array(z.string().trim().min(1).max(2_000)).max(30).default([]),
  /** Only meaningful for combinatorics/graph problems; absent for every other field. */
  bounds: z
    .object({
      minVertices: z.number().int().min(1).max(12).default(1),
      maxVertices: z.number().int().min(1).max(12).default(7),
    })
    .refine((v) => v.maxVertices >= v.minVertices, "Invalid bounds")
    .optional(),
  /** "prove" starts from an open statement; "expand" starts from `existingProof`. */
  mode: z.enum(["prove", "expand"]).default("prove"),
  existingProof: z.string().trim().max(20_000).optional(),
  userSources: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        url: z.string().url().refine(isPublicHttps, "A public HTTPS URL is required"),
        abstract: z.string().max(8_000).optional(),
      }),
    )
    .max(20)
    .default([]),
});
export type ProblemSpec = z.infer<typeof problemSpecSchema>;

// ---------------------------------------------------------------------------------------
// Stage output (what a model must return)
// ---------------------------------------------------------------------------------------

export const claimSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(5_000),
  kind: z.enum(claimKinds),
  verificationStatus: z.enum(verificationStatuses),
  evidenceRefs: z.array(z.string().max(120)).max(20).default([]),
  warnings: z.array(z.string().max(1_000)).max(10).default([]),
});

export const stageOutputSchema = z.object({
  summary: z.string().min(1).max(8_000),
  claims: z.array(claimSchema).max(30),
  artifacts: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        type: z.enum(artifactTypes),
        title: z.string().max(300),
        content: z.string().max(20_000),
        metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
      }),
    )
    .max(30)
    .default([]),
  openQuestions: z.array(z.string().max(2_000)).max(20).default([]),
  suggestedNextSteps: z.array(z.string().max(2_000)).max(10).default([]),
});
export type StageOutput = z.infer<typeof stageOutputSchema>;

const stringList = { type: "array", items: { type: "string" } } as const;

/** JSON Schema sent to the model. Keep in sync with `stageOutputSchema` (a test enforces it). */
export const stageOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "claims", "artifacts", "openQuestions", "suggestedNextSteps"],
  properties: {
    summary: { type: "string" },
    claims: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "kind", "verificationStatus", "evidenceRefs", "warnings"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          kind: { type: "string", enum: claimKinds },
          verificationStatus: { type: "string", enum: verificationStatuses },
          evidenceRefs: stringList,
          warnings: stringList,
        },
      },
    },
    artifacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "title", "content", "metadata"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: artifactTypes },
          title: { type: "string" },
          content: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
        },
      },
    },
    openQuestions: stringList,
    suggestedNextSteps: stringList,
  },
} as const;

// ---------------------------------------------------------------------------------------
// Model usage and run profiles
// ---------------------------------------------------------------------------------------

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

export const modelRefSchema = z.object({
  model: z.string().min(1).max(120),
  reasoning: reasoningSchema,
  maxOutputTokens: z.number().int().min(256).max(5000),
});
export type ModelRef = z.infer<typeof modelRefSchema>;

/** A profile assigns one model (with limits) to every stage. */
export type RunProfile = {
  id: string;
  name: string;
  totalOutputLimit: number;
  stages: Record<StageId, ModelRef>;
};

export const runProfileInputSchema = z.object({
  name: z.string().trim().min(3).max(80),
  totalOutputLimit: z.number().int().min(1000).max(18000),
  stages: z.object(
    Object.fromEntries(stageIds.map((stage) => [stage, modelRefSchema])) as Record<
      StageId,
      typeof modelRefSchema
    >,
  ),
});
