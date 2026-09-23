import { idempotent, parseBody, route } from "@/lib/http";
import { advanceRun } from "@/lib/orchestrator";
import { modelRefSchema } from "@/lib/research-types";

/** An optional explicit model choice (used by "Reroute to …"); an empty body uses the profile. */
const overrideSchema = modelRefSchema.partial();

export const POST = route((context) =>
  idempotent(context, `advance:${context.id}`, async () =>
    advanceRun(context.user.userId, context.id, await parseBody(context.request, overrideSchema)),
  ),
);
