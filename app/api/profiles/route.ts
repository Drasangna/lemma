import { idempotent, parseBody, route } from "@/lib/http";
import { runProfileInputSchema } from "@/lib/research-types";
import { createProfile, listProfiles } from "@/lib/repository";

export const GET = route(async ({ user }) => ({ profiles: listProfiles(user.userId) }));

export const POST = route((context) =>
  idempotent(
    context,
    "create-profile",
    async () => ({
      profile: createProfile(context.user.userId, await parseBody(context.request, runProfileInputSchema)),
    }),
    201,
  ),
);
