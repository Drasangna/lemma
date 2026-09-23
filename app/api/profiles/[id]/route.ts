import { idempotent, parseBody, route } from "@/lib/http";
import { runProfileInputSchema } from "@/lib/research-types";
import { deleteProfile, updateProfile } from "@/lib/repository";

export const PATCH = route((context) =>
  idempotent(context, `update-profile:${context.id}`, async () => ({
    profile: updateProfile(
      context.user.userId,
      context.id,
      await parseBody(context.request, runProfileInputSchema),
    ),
  })),
);

export const DELETE = route(async ({ user, id }) => {
  deleteProfile(user.userId, id);
  return null;
});
