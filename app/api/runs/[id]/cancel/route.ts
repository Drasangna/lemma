import { idempotent, route } from "@/lib/http";
import { cancelRun } from "@/lib/repository";

export const POST = route((context) =>
  idempotent(context, `cancel:${context.id}`, async () => cancelRun(context.user.userId, context.id)),
);
