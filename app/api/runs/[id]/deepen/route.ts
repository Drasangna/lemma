import { idempotent, parseBody, route } from "@/lib/http";
import { deepenStage } from "@/lib/orchestrator";
import { modelRefSchema, stageIdSchema } from "@/lib/research-types";

const deepenSchema = modelRefSchema.extend({
  stage: stageIdSchema,
  reasoning: modelRefSchema.shape.reasoning.default("high"),
  maxOutputTokens: modelRefSchema.shape.maxOutputTokens.default(5000),
});

export const POST = route((context) =>
  idempotent(context, `deepen:${context.id}`, async () => {
    const { stage, ...ref } = await parseBody(context.request, deepenSchema);
    return deepenStage(context.user.userId, context.id, stage, ref);
  }),
);
