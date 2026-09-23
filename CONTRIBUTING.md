# Contributing to Lemma

Lemma is a small app on purpose: a React UI, a handful of API routes, one orchestrator, and a local SQLite file. This guide shows where everything lives and how to make the changes people most often want.

## Setup and checks

```sh
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY to run real models
npm run dev                  # http://localhost:3000 (the database creates and migrates itself)
npm run check                # typecheck + lint + all tests — run this before every commit
npm run format               # Prettier
```

The test suite never spends credits: it mocks OpenRouter, Crossref and arXiv. `tests/api-flow.test.ts` drives the real route handlers against a temporary database, so it is the best place to see how everything fits together.

## How a request flows

```
browser ──▶ app/api/**/route.ts ──▶ lib/orchestrator.ts ──▶ lib/providers (OpenRouter)
  UI          route() + idempotent()      one stage at a time         one model call, no retries
components/         │                          │
workspace/          ▼                          ▼
              lib/repository.ts        lib/tools (literature search, computation kernels)
                    │                          │
                    └──────── db/ (SQLite via Drizzle) ◀── lib/claim-verification.ts (the claim policy)
```

| Path                                    | What it does                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `lib/research-types.ts`                 | Every schema and type. **Read this first.** Stage list, claim labels, problem spec, model output shape.   |
| `lib/orchestrator.ts`                   | Runs one pipeline stage: load context → run tools → call the model → verify claims → save atomically.    |
| `lib/claim-verification.ts`             | The claim policy as a short pure module. A claim may only be `source-supported` / `computation-supported` if it cites evidence Lemma's own tools recorded. |
| `lib/stage-prompts.ts`                  | The prompt text for each stage, in "prove" and "expand" mode.                                             |
| `lib/tools/`                            | `literature.ts` (Crossref + arXiv), `combinatorics.ts` (graph kernel), `index.ts` (kernel registry + cache). |
| `lib/providers/`                        | The model gateway. One adapter today (OpenRouter); `types.ts` is the interface for another.               |
| `lib/models.ts`, `lib/run-profiles.ts`  | Which models exist, and the built-in profiles that assign them to stages.                                 |
| `lib/http.ts`                           | `route()` wrapper, `idempotent()`, error mapping. Every API route is built from these.                    |
| `lib/repository.ts`, `db/`              | All database reads/writes, scoped by `ownerId`. Schema in `db/schema.ts`, migrations in `drizzle/`.       |
| `components/workspace/`                 | The UI. `use-workspace.ts` holds all state/actions; the other files are presentational tabs and panels.   |
| `app/globals.css`                       | All custom styling, in labeled sections. `components/ui/` is vendored shadcn — leave it alone.            |

## Rules that must keep holding

These are the product's promises to researchers; tests enforce most of them.

1. **No `proved` status, ever.** Model agreement is not verification.
2. **Nothing paid happens automatically.** No retries, no model fallback, no automatic deep passes. Every model call is one explicit request.
3. **A stage is saved before the run advances** (one database transaction in `saveCompletedStage`).
4. **Only tool-recorded evidence counts.** Model-authored artifacts are never evidence.
5. **Every mutation requires an `Idempotency-Key`**, so a repeated click never repeats a paid call. Use `idempotent()`.
6. **Models never run code or fetch URLs.** Tools are deterministic and bounded.
7. **Secrets stay server-side.** `OPENROUTER_API_KEY` is never stored or returned.

## Recipes

### Add or swap a model

Edit `MODELS` in `lib/models.ts` (mark expensive ones `deep: true`). To change what a built-in profile uses, edit `lib/run-profiles.ts`. Check current slugs at <https://openrouter.ai/models>.

### Support a new field of mathematics with a computation kernel

Kernels are how a claim can earn `computation-supported`. Add one entry to `computationKernels` in `lib/tools/index.ts`:

```ts
{
  id: "number-theory-kernel",
  appliesTo: (problem) => /number theory/i.test(problem.field),
  run: (problem) => runNumberTheoryCheck(problem.statement), // { id: string, ... } or null
}
```

`run` must be deterministic and bounded, and return an object with a string `id` (claims cite it) or `null` when it cannot check the statement. Nothing else changes: the orchestrator, claim verification, and audit UI pick it up automatically. Put the implementation next to `lib/tools/combinatorics.ts` and add tests like `tests/combinatorics.test.ts`.

### Change what a stage asks the model

Edit `ROLES` (prove mode) or `EXPAND_ROLES` (expand mode) in `lib/stage-prompts.ts`. Tests in `tests/stage-prompts.test.ts` pin the important wording.

### Add an API route

```ts
// app/api/things/route.ts
import { idempotent, parseBody, route } from "@/lib/http";

export const POST = route((context) =>
  idempotent(context, "create-thing", async () => {
    const body = await parseBody(context.request, thingSchema);
    return { thing: createThing(context.user.userId, body) };
  }, 201),
);
```

`route()` supplies the user, the `[id]` segment, JSON responses and error mapping; validation errors become a readable 400 automatically. Put the database code in `lib/repository.ts`, and add a case to `tests/api-flow.test.ts`.

### Add a database column

1. Edit `db/schema.ts`.
2. `npm run db:generate` creates a migration in `drizzle/`. Commit it.
3. Restart the dev server — migrations apply automatically the first time the database is used.

### Add a UI tab

Create `components/workspace/my-tab.tsx` taking `{ ws }: { ws: Workspace }`, add a `TabsTrigger`/`TabsContent` in `app/research-workspace.tsx`, and put any new state or actions in `use-workspace.ts`.

## Style

- Prettier decides formatting (`npm run format`). Prefer small named functions over long chains.
- Comments explain _why_ (a constraint, an invariant), not what the code says.
- The schema in `lib/research-types.ts` is the single source of truth; derive types from it instead of copying them.
