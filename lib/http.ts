/**
 * Small helpers shared by every API route: error mapping, JSON body parsing, the `route()`
 * wrapper, and idempotent request handling.
 */
import { and, eq } from "drizzle-orm";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { getDb } from "@/db";
import { idempotencyRecords } from "@/db/schema";
import { getLocalUser, type LocalUser } from "./local-user";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message, details: error.details }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const summary = error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return Response.json({ error: `Invalid request. ${summary}`, details: error.issues }, { status: 400 });
  }
  console.error(error);
  return Response.json(
    { error: error instanceof Error ? error.message : "Unexpected error" },
    { status: 500 },
  );
}

/** Reads and validates a JSON body. An empty body counts as `{}` so optional-body routes work. */
export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.output<S>> {
  const text = await request.text();
  let body: unknown = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(400, "Request body must be valid JSON.");
    }
  }
  return schema.parse(body);
}

export type RouteContext = {
  request: Request;
  user: LocalUser;
  /** The `[id]` path segment, or "". */ id: string;
};
type RouteResult = Response | object | null;

/** Wraps a handler with the local user, `[id]` resolution, JSON responses, and error mapping. */
export function route(handler: (context: RouteContext) => Promise<RouteResult>) {
  // Routes without a dynamic segment may receive `params` as null, so tolerate that.
  return async (request: Request, segment?: { params?: Promise<{ id?: string }> | null }) => {
    try {
      const id = (await segment?.params)?.id ?? "";
      const result = await handler({ request, user: getLocalUser(), id });
      if (result instanceof Response) return result;
      return result === null ? new Response(null, { status: 204 }) : Response.json(result);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Runs a mutation at most once per `Idempotency-Key`. A repeated request replays the stored
 * response (HTTP 200) instead of repeating the work, so a retried click never repeats a paid call.
 */
export async function idempotent(
  { request, user }: Pick<RouteContext, "request" | "user">,
  operation: string,
  run: () => Promise<object>,
  status = 200,
): Promise<Response> {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 160) throw new ApiError(400, "A valid Idempotency-Key header is required.");

  const db = getDb();
  const match = and(
    eq(idempotencyRecords.ownerId, user.userId),
    eq(idempotencyRecords.key, key),
    eq(idempotencyRecords.operation, operation),
  );
  const [previous] = db.select().from(idempotencyRecords).where(match).limit(1).all();
  if (previous) return Response.json(parseJson(previous.responseJson, null));

  const response = await run();
  db.insert(idempotencyRecords)
    .values({
      id: crypto.randomUUID(),
      ownerId: user.userId,
      key,
      operation,
      responseJson: JSON.stringify(response),
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
  return Response.json(response, { status });
}
