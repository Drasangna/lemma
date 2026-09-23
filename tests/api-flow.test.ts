/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * End-to-end tests that drive the real route handlers against a throwaway SQLite
 * database. Only the network is mocked (OpenRouter, Crossref, arXiv), so these cover
 * the full request → orchestrator → database → response path.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "lemma-test-"));
process.env.LEMMA_DB_PATH = join(dir, "test.db");
process.env.OPENROUTER_API_KEY = "test-key";
after(() => rmSync(dir, { recursive: true, force: true }));

// The database module reads its path at import time, so import the app after setting env.
const projectsRoute = await import("@/app/api/projects/route");
const projectRoute = await import("@/app/api/projects/[id]/route");
const runsRoute = await import("@/app/api/runs/route");
const runRoute = await import("@/app/api/runs/[id]/route");
const advanceRoute = await import("@/app/api/runs/[id]/advance/route");
const cancelRoute = await import("@/app/api/runs/[id]/cancel/route");
const deepenRoute = await import("@/app/api/runs/[id]/deepen/route");
const profilesRoute = await import("@/app/api/profiles/route");
const profileRoute = await import("@/app/api/profiles/[id]/route");
const providersRoute = await import("@/app/api/providers/route");

// Applying migrations is idempotent, so this is safe whether or not the app migrates itself.
const { default: Database } = await import("better-sqlite3");
const { drizzle } = await import("drizzle-orm/better-sqlite3");
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
{
  const sqlite = new Database(process.env.LEMMA_DB_PATH!);
  migrate(drizzle(sqlite), { migrationsFolder: "./drizzle" });
  sqlite.close();
}

// ---------------------------------------------------------------- network mock

type ModelRequest = { model: string; system: string; input: any };
const modelRequests: ModelRequest[] = [];
let modelReply: (request: ModelRequest) => Response = () => stageReply();

function stageReply(claims: any[] = [], completionTokens = 50) {
  return Response.json({
    id: `resp-${modelRequests.length}`,
    model: "deepseek/deepseek-chat",
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            summary: "A stage summary.",
            claims,
            artifacts: [],
            openQuestions: [],
            suggestedNextSteps: [],
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: completionTokens, total_tokens: 100 + completionTokens },
  });
}

globalThis.fetch = (async (input: any, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("https://openrouter.ai/")) {
    const body = JSON.parse(String(init?.body));
    const request = {
      model: body.model,
      system: body.messages[0].content,
      input: JSON.parse(body.messages[1].content),
    };
    modelRequests.push(request);
    return modelReply(request);
  }
  if (url.startsWith("https://api.crossref.org/")) {
    return Response.json({
      message: {
        items: [
          {
            DOI: "10.1000/Mantel",
            title: ["On a problem of graph theory"],
            author: [{ given: "W.", family: "Mantel" }],
            published: { "date-parts": [[1907]] },
          },
        ],
      },
    });
  }
  if (url.startsWith("https://export.arxiv.org/")) return new Response("<feed></feed>");
  throw new Error(`Unexpected network request: ${url}`);
}) as typeof fetch;

// --------------------------------------------------------------------- helpers

let keyCounter = 0;
const nextKey = () => `key-${++keyCounter}`;

async function call(
  handler: (request: Request, context: any) => Promise<Response>,
  method: string,
  body?: unknown,
  options: { id?: string; key?: string } = {},
) {
  const request = new Request("http://localhost/api", {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.key ? { "idempotency-key": options.key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id: options.id ?? "" }) });
  const json: any = response.status === 204 ? null : await response.json();
  return { status: response.status, json };
}

const problem = (overrides: Record<string, unknown> = {}) => ({
  title: "Mantel's theorem",
  field: "combinatorics",
  statement: "If G is a triangle-free graph on n vertices, then e(G) <= floor(n^2/4).",
  bounds: { minVertices: 1, maxVertices: 6 },
  ...overrides,
});

async function createProject(overrides: Record<string, unknown> = {}) {
  const { status, json } = await call(projectsRoute.POST, "POST", problem(overrides), { key: nextKey() });
  assert.equal(status, 201);
  return json.project.id as string;
}

async function startRun(projectId: string, profileId = "deepseek-economy") {
  const { status, json } = await call(runsRoute.POST, "POST", { projectId, profileId }, { key: nextKey() });
  assert.equal(status, 201);
  return json.run.id as string;
}

const advance = (runId: string, override: Record<string, unknown> = {}) =>
  call(advanceRoute.POST, "POST", override, { id: runId, key: nextKey() });
const getRun = async (runId: string) => (await call(runRoute.GET, "GET", undefined, { id: runId })).json;

test.beforeEach(() => {
  modelRequests.length = 0;
  modelReply = () => stageReply();
});

// ----------------------------------------------------------------------- tests

test("creating a project is idempotent and round-trips every field", async () => {
  const key = nextKey();
  const body = problem({
    field: "number theory",
    bounds: undefined,
    mode: "expand",
    existingProof: "Consider the group (Z/pZ)*.",
  });
  const first = await call(projectsRoute.POST, "POST", body, { key });
  const replay = await call(projectsRoute.POST, "POST", { ...body, title: "A different title" }, { key });

  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.json.project.id, first.json.project.id);
  assert.equal(replay.json.project.title, "Mantel's theorem");
  assert.deepEqual(
    {
      field: first.json.project.field,
      mode: first.json.project.mode,
      bounds: first.json.project.bounds,
      existingProof: first.json.project.existingProof,
    },
    {
      field: "number theory",
      mode: "expand",
      bounds: undefined,
      existingProof: "Consider the group (Z/pZ)*.",
    },
  );

  const patched = await call(
    projectRoute.PATCH,
    "PATCH",
    { ...body, field: "analysis" },
    { id: first.json.project.id },
  );
  assert.equal(patched.json.project.field, "analysis");
  assert.equal(
    (await call(projectRoute.GET, "GET", undefined, { id: first.json.project.id })).json.project.field,
    "analysis",
  );
});

test("bad requests get a readable 400, not a server error", async () => {
  const noKey = await call(projectsRoute.POST, "POST", problem());
  assert.equal(noKey.status, 400);
  assert.match(noKey.json.error, /Idempotency-Key/);

  const invalid = await call(projectsRoute.POST, "POST", { title: "x" }, { key: nextKey() });
  assert.equal(invalid.status, 400);
  assert.match(invalid.json.error, /title: String must contain at least 3 character/);
  assert.match(invalid.json.error, /statement: Required/);

  const notJson = await projectsRoute.POST(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "idempotency-key": nextKey() },
      body: "{oops",
    }),
  );
  assert.equal(notJson.status, 400);
});

test("the project list stays lightweight and the run list names each project's runs", async () => {
  const projectId = await createProject({ title: "Listing test" });
  const runId = await startRun(projectId);
  const { projects, runs } = (await call(projectsRoute.GET, "GET")).json;

  assert.ok(projects.some((p: any) => p.id === projectId));
  const run = runs.find((r: any) => r.id === runId);
  assert.deepEqual(Object.keys(run).sort(), ["id", "projectId", "status", "updatedAt"]);
});

test("a full run completes six stages, records tools, and downgrades unsupported claims", async () => {
  const projectId = await createProject();
  const runId = await startRun(projectId);

  modelReply = (request) =>
    request.input.task === "evidence"
      ? stageReply([
          {
            id: "c1",
            text: "No finite counterexample.",
            kind: "observation",
            verificationStatus: "computation-supported",
            evidenceRefs: ["triangle-free-n6"],
            warnings: [],
          },
          {
            id: "c2",
            text: "Cites a source that was never retrieved.",
            kind: "fact",
            verificationStatus: "source-supported",
            evidenceRefs: ["doi:10.9999/invented"],
            warnings: [],
          },
          {
            id: "c3",
            text: "Mantel proved this.",
            kind: "fact",
            verificationStatus: "source-supported",
            evidenceRefs: ["doi:10.1000/mantel"],
            warnings: [],
          },
        ])
      : stageReply();

  const statuses: string[] = [];
  for (let i = 0; i < 6; i++) {
    const { status, json } = await advance(runId);
    assert.equal(status, 200);
    statuses.push(json.status);
  }
  assert.deepEqual(statuses, ["paused", "paused", "paused", "paused", "paused", "completed"]);
  assert.equal((await advance(runId)).status, 409);

  const { run, results } = await getRun(runId);
  assert.equal(run.status, "completed");
  assert.equal(run.currentStage, 6);
  assert.equal(run.inputTokens, 600);
  assert.equal(run.outputTokens, 300);
  assert.deepEqual(
    results.map((r: any) => r.stage),
    ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"],
  );
  assert.ok(results.every((r: any) => r.provider === "openrouter" && !r.isDeepPass));

  const evidence = results.find((r: any) => r.stage === "evidence");
  assert.deepEqual(
    evidence.toolRecords.map((t: any) => t.name),
    ["search_literature", "combinatorics-graph-kernel"],
  );
  const status = Object.fromEntries(evidence.output.claims.map((c: any) => [c.id, c.verificationStatus]));
  assert.deepEqual(status, { c1: "computation-supported", c2: "unverified", c3: "source-supported" });
  assert.match(evidence.output.claims[1].warnings.join(" "), /Downgraded/);
});

test("advancing with the same idempotency key does not call the model twice", async () => {
  const runId = await startRun(await createProject());
  const key = nextKey();
  const first = await call(advanceRoute.POST, "POST", {}, { id: runId, key });
  const replay = await call(advanceRoute.POST, "POST", {}, { id: runId, key });

  assert.equal(modelRequests.length, 1);
  assert.equal(replay.json.stage, first.json.stage);
  assert.equal((await getRun(runId)).run.currentStage, 1);
});

test("problems outside combinatorics run literature search only", async () => {
  const runId = await startRun(
    await createProject({ title: "Fermat's little theorem", field: "number theory", bounds: undefined }),
  );
  await advance(runId);
  await advance(runId);

  const evidence = (await getRun(runId)).results.find((r: any) => r.stage === "evidence");
  assert.deepEqual(
    evidence.toolRecords.map((t: any) => t.name),
    ["search_literature"],
  );
});

test("expand mode sends the existing proof and reframed lemma instructions", async () => {
  const runId = await startRun(
    await createProject({ mode: "expand", existingProof: "Suppose G has a triangle; delete it." }),
  );
  await advance(runId);
  await advance(runId);
  await advance(runId);

  const [normalize, , lemmas] = modelRequests;
  assert.equal(normalize.input.problem.existingProof, "Suppose G has a triangle; delete it.");
  assert.match(lemmas.system, /generalizations/i);
  assert.equal(lemmas.input.problem.mode, "expand");
});

test("a failed stage is recorded, and retrying the same stage succeeds as attempt 2", async () => {
  const runId = await startRun(await createProject());
  modelReply = () => Response.json({ error: { message: "bad key" } }, { status: 401 });

  const failed = await advance(runId);
  assert.equal(failed.status, 401);
  let bundle = await getRun(runId);
  assert.equal(bundle.run.status, "failed");
  assert.equal(bundle.run.currentStage, 0);
  assert.equal(bundle.results[0].status, "failed");
  assert.equal(bundle.results[0].error.code, "authentication");

  modelReply = () => stageReply();
  assert.equal((await advance(runId)).status, 200);
  bundle = await getRun(runId);
  assert.equal(bundle.run.currentStage, 1);
  assert.deepEqual(
    bundle.results.map((r: any) => [r.status, r.attempt]),
    [
      ["failed", 1],
      ["completed", 2],
    ],
  );
});

test("an invalid model response fails the stage instead of being saved", async () => {
  const runId = await startRun(await createProject());
  modelReply = () =>
    Response.json({
      id: "x",
      model: "m",
      choices: [{ finish_reason: "stop", message: { content: "not json" } }],
      usage: {},
    });

  assert.equal((await advance(runId)).status, 422);
  const bundle = await getRun(runId);
  assert.equal(bundle.results[0].error.code, "invalid_output");
  assert.equal(bundle.results[0].output, null);
});

test("cancelling keeps completed stages and blocks further advancement", async () => {
  const runId = await startRun(await createProject());
  await advance(runId);
  assert.equal(
    (await call(cancelRoute.POST, "POST", undefined, { id: runId, key: nextKey() })).json.status,
    "cancelled",
  );

  assert.equal((await advance(runId)).status, 409);
  const bundle = await getRun(runId);
  assert.equal(bundle.run.status, "cancelled");
  assert.equal(bundle.results.length, 1);
});

test("deep passes are stored separately and limited to proofs and critique", async () => {
  const runId = await startRun(await createProject());
  const deepen = (stage: string) =>
    call(deepenRoute.POST, "POST", { stage, model: "openai/gpt-4o" }, { id: runId, key: nextKey() });

  assert.equal((await deepen("lemmas")).status, 400);
  assert.equal((await deepen("critique")).status, 200);

  const bundle = await getRun(runId);
  assert.equal(bundle.run.currentStage, 0);
  assert.equal(bundle.results.length, 1);
  assert.equal(bundle.results[0].isDeepPass, true);
  assert.match(modelRequests[0].system, /manually approved deep pass/);
});

test("a run stops before a stage that would exceed the profile's output limit", async () => {
  const stage = { model: "deepseek/deepseek-chat", reasoning: "low", maxOutputTokens: 600 };
  const profile = {
    name: `Tight ${nextKey()}`,
    totalOutputLimit: 1000,
    stages: Object.fromEntries(
      ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"].map((s) => [s, stage]),
    ),
  };
  const created = await call(profilesRoute.POST, "POST", profile, { key: nextKey() });
  assert.equal(created.status, 201);

  const runId = await startRun(await createProject(), created.json.profile.id);
  modelReply = () => stageReply([], 500);
  assert.equal((await advance(runId)).status, 200);
  assert.equal((await advance(runId)).status, 409);
});

test("saved profiles can be listed, renamed, and deleted; built-ins cannot be modified", async () => {
  const stage = { model: "openai/gpt-4o-mini", reasoning: "low", maxOutputTokens: 1000 };
  const stages = Object.fromEntries(
    ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"].map((s) => [s, stage]),
  );
  const name = `Custom ${nextKey()}`;
  const created = (
    await call(profilesRoute.POST, "POST", { name, totalOutputLimit: 6000, stages }, { key: nextKey() })
  ).json.profile;

  const listed = (await call(profilesRoute.GET, "GET")).json.profiles.map((p: any) => p.id);
  assert.ok(listed.includes("deepseek-economy") && listed.includes(created.id));

  const renamed = await call(
    profileRoute.PATCH,
    "PATCH",
    { name: `${name} v2`, totalOutputLimit: 6000, stages },
    { id: created.id, key: nextKey() },
  );
  assert.equal(renamed.json.profile.name, `${name} v2`);
  assert.equal(
    (
      await call(
        profileRoute.PATCH,
        "PATCH",
        { name: "x-x-x", totalOutputLimit: 6000, stages },
        { id: "deepseek-economy", key: nextKey() },
      )
    ).status,
    404,
  );

  await call(profileRoute.DELETE, "DELETE", undefined, { id: created.id });
  assert.ok(!(await call(profilesRoute.GET, "GET")).json.profiles.some((p: any) => p.id === created.id));
});

test("the provider status reports the configured OpenRouter models", async () => {
  const status = (await call(providersRoute.GET, "GET")).json;
  assert.equal(status.provider, "openrouter");
  assert.equal(status.configured, true);
  assert.ok(status.models.some((m: any) => m.deep) && status.models.some((m: any) => !m.deep));
});

test("creating a profile is idempotent", async () => {
  const stage = { model: "openai/gpt-4o-mini", reasoning: "low", maxOutputTokens: 1000 };
  const stages = Object.fromEntries(
    ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"].map((s) => [s, stage]),
  );
  const body = { name: `Once ${nextKey()}`, totalOutputLimit: 6000, stages };
  const key = nextKey();

  const first = await call(profilesRoute.POST, "POST", body, { key });
  const replay = await call(profilesRoute.POST, "POST", body, { key });
  assert.equal(replay.status, 200);
  assert.equal(replay.json.profile.id, first.json.profile.id);
});

test("model-authored artifacts never count as recorded evidence", async () => {
  const runId = await startRun(await createProject({ title: "Fabrication test" }));
  const fakeSource = {
    id: "doi:10.9999/fabricated",
    type: "source",
    title: "A paper the model invented",
    content: "…",
    metadata: {},
  };
  const citesFake = {
    id: "c1",
    text: "Cites the invented paper.",
    kind: "fact",
    verificationStatus: "source-supported",
    evidenceRefs: [fakeSource.id],
    warnings: [],
  };

  // Stage 2 (evidence) emits a fake "source" artifact; stage 3 then cites it.
  modelReply = (request) =>
    Response.json({
      id: "r",
      model: "m",
      usage: {},
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              summary: "s",
              claims: request.input.task === "lemmas" ? [citesFake] : [],
              artifacts: request.input.task === "evidence" ? [fakeSource] : [],
              openQuestions: [],
              suggestedNextSteps: [],
            }),
          },
        },
      ],
    });
  for (let i = 0; i < 3; i++) await advance(runId);

  const lemmas = (await getRun(runId)).results.find((r: any) => r.stage === "lemmas");
  assert.equal(lemmas.output.claims[0].verificationStatus, "unverified");
});

test("a kernel that cannot check the statement records no computation evidence", async () => {
  const runId = await startRun(
    await createProject({ title: "Planar test", statement: "Every planar graph is 4-colorable." }),
  );
  await advance(runId);
  await advance(runId);

  const evidence = (await getRun(runId)).results.find((r: any) => r.stage === "evidence");
  assert.deepEqual(
    evidence.toolRecords.map((t: any) => t.name),
    ["search_literature"],
  );
});

test("a deep pass does not disturb the attempt count of the next normal attempt", async () => {
  const runId = await startRun(await createProject({ title: "Attempt numbering" }));
  for (let i = 0; i < 3; i++) await advance(runId);
  await call(
    deepenRoute.POST,
    "POST",
    { stage: "proofs", model: "openai/gpt-4o" },
    { id: runId, key: nextKey() },
  );
  await advance(runId);

  const proofs = (await getRun(runId)).results.filter((r: any) => r.stage === "proofs");
  assert.deepEqual(
    proofs.map((r: any) => [r.isDeepPass, r.attempt]),
    [
      [true, 1],
      [false, 1],
    ],
  );
});

test("routes without a dynamic segment tolerate missing or null params (as the real server passes)", async () => {
  const request = () => new Request("http://localhost/api");
  for (const context of [undefined, { params: null }, { params: Promise.resolve(null) }]) {
    assert.equal((await projectsRoute.GET(request(), context as any)).status, 200);
    assert.equal((await providersRoute.GET(request(), context as any)).status, 200);
  }
});
