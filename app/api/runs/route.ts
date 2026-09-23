import { z } from "zod";
import { idempotent, parseBody, route } from "@/lib/http";
import { createRun } from "@/lib/repository";
import { DEFAULT_PROFILE_ID } from "@/lib/run-profiles";

const startRunSchema = z.object({
  projectId: z.string().min(1),
  profileId: z.string().default(DEFAULT_PROFILE_ID),
});

export const POST = route((context) =>
  idempotent(
    context,
    "start-run",
    async () => {
      const { projectId, profileId } = await parseBody(context.request, startRunSchema);
      return { run: createRun(context.user.userId, projectId, profileId) };
    },
    201,
  ),
);
