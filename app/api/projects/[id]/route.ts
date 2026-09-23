import { parseBody, route } from "@/lib/http";
import { problemSpecSchema } from "@/lib/research-types";
import { deleteProject, getOwnedProject, serializeProject, updateProject } from "@/lib/repository";

export const GET = route(async ({ user, id }) => ({
  project: serializeProject(getOwnedProject(user.userId, id)),
}));

export const PATCH = route(async ({ request, user, id }) => ({
  project: updateProject(user.userId, id, await parseBody(request, problemSpecSchema)),
}));

export const DELETE = route(async ({ user, id }) => {
  deleteProject(user.userId, id);
  return null;
});
