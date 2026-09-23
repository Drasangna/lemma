import { idempotent, parseBody, route } from "@/lib/http";
import { problemSpecSchema } from "@/lib/research-types";
import { createProject, listOwnedProjects, listOwnedRuns } from "@/lib/repository";

export const GET = route(async ({ user }) => ({
  projects: listOwnedProjects(user.userId),
  runs: listOwnedRuns(user.userId),
}));

export const POST = route((context) =>
  idempotent(
    context,
    "create-project",
    async () => ({
      project: createProject(context.user.userId, await parseBody(context.request, problemSpecSchema)),
    }),
    201,
  ),
);
