import { route } from "@/lib/http";
import { getRunBundle } from "@/lib/repository";

export const GET = route(async ({ user, id }) => getRunBundle(user.userId, id));
