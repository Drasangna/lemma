import { z } from "zod";

export const stageIds = ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"] as const;
export const stageIdSchema = z.enum(stageIds); export type StageId = z.infer<typeof stageIdSchema>;
export const reasoningSchema = z.enum(["none", "low", "medium", "high"]); export type ReasoningLevel = z.infer<typeof reasoningSchema>;
export const verificationStatusSchema = z.enum(["source-supported", "computation-supported", "internally-checked", "contested", "unverified"]);

function isPublicHttps(value:string){try{const url=new URL(value);if(url.protocol!=="https:")return false;const host=url.hostname.toLowerCase();if(host==="localhost"||host.endsWith(".local")||host==="::1")return false;if(/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host))return false;const match=host.match(/^172\.(\d+)\./);if(match&&Number(match[1])>=16&&Number(match[1])<=31)return false;return true}catch{return false}}

export const COMBINATORICS_FIELD_PATTERN = /\b(combinatorics|graph)\b/i;

export const problemSpecSchema = z.object({
  title: z.string().trim().min(3).max(160), field: z.string().trim().min(2).max(60).default("combinatorics"), statement: z.string().trim().min(10).max(12_000),
  definitions: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]), assumptions: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  knownResults: z.array(z.string().trim().min(1).max(2_000)).max(30).default([]),
  bounds: z.object({ minVertices: z.number().int().min(1).max(12).default(1), maxVertices: z.number().int().min(1).max(12).default(7) }).refine((v) => v.maxVertices >= v.minVertices, "Invalid bounds").optional(),
  mode: z.enum(["prove", "expand"]).default("prove"),
  existingProof: z.string().trim().max(20_000).optional(),
  userSources: z.array(z.object({ title: z.string().min(1).max(300), url: z.string().url().refine(isPublicHttps, "A public HTTPS URL is required"), abstract: z.string().max(8_000).optional() })).max(20).default([]),
});
export type ProblemSpec = z.infer<typeof problemSpecSchema>;

export const claimSchema = z.object({ id: z.string().min(1).max(80), text: z.string().min(1).max(5_000), kind: z.enum(["fact", "observation", "lemma", "conjecture", "proof-step", "critique"]), verificationStatus: verificationStatusSchema, evidenceRefs: z.array(z.string().max(120)).max(20).default([]), warnings: z.array(z.string().max(1_000)).max(10).default([]) });
export const stageOutputSchema = z.object({
  summary: z.string().min(1).max(8_000), claims: z.array(claimSchema).max(30),
  artifacts: z.array(z.object({ id: z.string().min(1).max(80), type: z.enum(["source", "computation", "argument", "counterexample", "report-section"]), title: z.string().max(300), content: z.string().max(20_000), metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}) })).max(30).default([]),
  openQuestions: z.array(z.string().max(2_000)).max(20).default([]), suggestedNextSteps: z.array(z.string().max(2_000)).max(10).default([]),
});
export type StageOutput = z.infer<typeof stageOutputSchema>;

export const stageOutputJsonSchema = {
  type:"object", additionalProperties:false,
  properties:{ summary:{type:"string"}, claims:{type:"array",maxItems:30,items:{type:"object",additionalProperties:false,properties:{id:{type:"string"},text:{type:"string"},kind:{type:"string",enum:["fact","observation","lemma","conjecture","proof-step","critique"]},verificationStatus:{type:"string",enum:["source-supported","computation-supported","internally-checked","contested","unverified"]},evidenceRefs:{type:"array",items:{type:"string"}},warnings:{type:"array",items:{type:"string"}}},required:["id","text","kind","verificationStatus","evidenceRefs","warnings"]}},artifacts:{type:"array",items:{type:"object",additionalProperties:false,properties:{id:{type:"string"},type:{type:"string",enum:["source","computation","argument","counterexample","report-section"]},title:{type:"string"},content:{type:"string"},metadata:{type:"object",additionalProperties:true}},required:["id","type","title","content","metadata"]}},openQuestions:{type:"array",items:{type:"string"}},suggestedNextSteps:{type:"array",items:{type:"string"}}},
  required:["summary","claims","artifacts","openQuestions","suggestedNextSteps"],
} as const;

export type Usage = { inputTokens:number; outputTokens:number; reasoningTokens:number; cachedTokens:number; totalTokens:number };
export type ModelRef = { model:string; reasoning:ReasoningLevel; maxOutputTokens:number };
export type RunProfile = { id:string; name:string; totalOutputLimit:number; stages:Record<StageId,ModelRef> };
export const modelRefSchema=z.object({model:z.string().min(1).max(120),reasoning:reasoningSchema,maxOutputTokens:z.number().int().min(256).max(5000)});
export const runProfileInputSchema=z.object({
  name:z.string().trim().min(3).max(80),
  totalOutputLimit:z.number().int().min(1000).max(18000),
  stages:z.object({normalize:modelRefSchema,evidence:modelRefSchema,lemmas:modelRefSchema,proofs:modelRefSchema,critique:modelRefSchema,synthesis:modelRefSchema}),
});
