# Axiom implementation handoff

This document is the complete technical handoff for another coding agent or developer. Read this file, `HOW_TO_USE.md`, and the current source before making changes. Preserve the provider-neutral contracts, claim-label rules, owner checks, idempotency requirements, and the rule against automatic paid retries or cross-provider fallback.

## Current result

- Product: Axiom, a private AI-assisted combinatorics research workspace.
- Production site: <https://axiom-research-workspace.karabhi2007.chatgpt.site>
- Sites project ID: `appgprj_6aa8b58de33c81918f47abd1f906a382`
- Hosting mode: private, owner-only ChatGPT sign-in.
- Runtime: portable Sites React/TypeScript starter using Vinext and Cloudflare Workers.
- Persistence: Cloudflare D1 bound as `DB`; no R2 binding.
- Supported model providers: OpenAI and DeepSeek.
- Production provider secrets at handoff: none configured. The application therefore loads normally but disables model-backed runs until at least one provider key is added.
- Live provider smoke tests: intentionally not run because no provider secrets were available. No OpenAI or DeepSeek credits were consumed during implementation.

## What was built

The first milestone implements the full private research workflow:

1. Create and edit a structured combinatorics problem.
2. Select a built-in or private saved run profile.
3. Inspect the provider/model assignments and output allowance before starting.
4. Create a persisted research run without spending model tokens.
5. Advance the run one stage at a time or explicitly run all remaining stages.
6. Persist every successful or failed stage before any later stage proceeds.
7. Resume a run after closing the browser without repeating completed provider calls.
8. Cancel at a stage boundary while retaining completed work.
9. Retry the same model after failure or explicitly reroute the current stage.
10. Run a separate manual deep critique with OpenAI Sol or DeepSeek Pro.
11. Inspect normalized stage artifacts, provider/model provenance, usage, warnings, and claim statuses.
12. Render a KaTeX dossier and open the browser print dialog for Save as PDF.

The UI is a compact mathematical-journal/laboratory-instrument workspace with a research-file rail, central investigation surface, and audit lens. It has responsive layouts and keyboard-accessible native/shadcn controls.

## Repository map

### Application UI

- `app/page.tsx` reads the optional ChatGPT identity and renders the workspace.
- `app/research-workspace.tsx` contains the primary client UI and its project, profile, run, retry, cancellation, deep-pass, audit, resume, and print interactions.
- `app/webmcp.tsx` registers the three page-scoped WebMCP tools.
- `app/globals.css` contains the visual system, responsive layout, claim colors, and print stylesheet.
- `app/layout.tsx` defines metadata and loads KaTeX CSS.
- `app/chatgpt-auth.ts` provides Sites-owned Sign in with ChatGPT helpers.
- `public/favicon.svg` is the Axiom favicon.

### Authenticated API routes

- `GET /api/providers` returns configured provider capabilities, configured models, and built-in profiles. It never returns keys.
- `GET /api/projects` lists the signed-in owner's projects and recent runs.
- `POST /api/projects` creates a project and requires `Idempotency-Key`.
- `GET /api/projects/:id` reads an owned project.
- `PATCH /api/projects/:id` replaces the structured problem specification.
- `DELETE /api/projects/:id` deletes an owned project.
- `GET /api/profiles` lists built-in and private saved profiles.
- `POST /api/profiles` creates a private profile and requires `Idempotency-Key`.
- `PATCH /api/profiles/:id` updates an owned non-built-in profile and requires `Idempotency-Key`.
- `DELETE /api/profiles/:id` deletes an owned non-built-in profile.
- `POST /api/runs` snapshots the selected profile into a new run and requires `Idempotency-Key`.
- `GET /api/runs/:id` returns an owned run, project, normalized results, usage, tools, and errors.
- `POST /api/runs/:id/advance` runs exactly one pending stage and requires `Idempotency-Key`.
- `POST /api/runs/:id/cancel` records cancellation and requires `Idempotency-Key`.
- `POST /api/runs/:id/deepen` creates a separate deep proof/critique result and requires `Idempotency-Key`.

Every route derives ownership from the dispatch-provided ChatGPT user ID. Email is display information only and is not used as the durable ownership key.

### Research engine

- `lib/orchestrator.ts` owns stage transitions, stage-boundary limits, context collection, evidence-tool execution, provider calls, success/failure persistence, claim-support normalization, cancellation preservation, and deep-pass accounting.
- `lib/stage-prompts.ts` provides stable prompt prefixes and the stage-specific role instructions.
- `lib/research-types.ts` defines the application-owned Zod schemas and shared TypeScript types.
- `lib/repository.ts` contains owner-scoped reads, serialization, and idempotency replay/storage.
- `lib/api-helpers.ts` contains API authentication, normalized errors, idempotency-key parsing, and safe JSON parsing.
- `lib/run-profiles.ts` defines the built-in profiles.

The fixed stage order is:

1. `normalize`
2. `evidence`
3. `lemmas`
4. `proofs`
5. `critique`
6. `synthesis`

The browser requests one stage at a time. The `Run remaining` button still sends sequential stage requests; it does not turn the whole workflow into one fragile server call.

### Provider abstraction

- `lib/providers/types.ts` defines `ModelProviderAdapter`, capabilities, normalized requests/responses, tool-result continuation, usage, and normalized errors.
- `lib/providers/openai.ts` implements the OpenAI Responses API adapter.
- `lib/providers/deepseek.ts` implements the DeepSeek Responses-compatible adapter.
- `lib/providers/shared.ts` extracts output text, validates JSON, normalizes usage, maps HTTP errors, and applies a 55-second request timeout.
- `lib/providers/index.ts` selects a provider strictly from the requested provider ID and reads server-only secrets.

`ModelProviderAdapter` exposes:

- `providerId`
- capability declarations for structured output, function tools, reasoning controls, streaming, and usage reporting
- `configuredModels()`
- `generateStructured(request)`
- `continueWithToolResults(request, previous, results)`

Both adapters return the same `ProviderResponse` and validate provider output against `StageOutput`. Provider-specific response fields do not enter claims, evidence, or dossier rendering.

The current adapters call:

- OpenAI: `POST https://api.openai.com/v1/responses`
- DeepSeek: `POST https://api.deepseek.com/responses`

Both request JSON Schema output, disable provider-side storage, record the returned response/model identifiers, and normalize token categories. There is no arbitrary base URL configuration.

### Provider models and profiles

Built-in profiles:

- `deepseek-economy`: `deepseek-flash`, low reasoning, all normal stages. This is the default.
- `openai-economy`: `gpt-5.6-luna`, low reasoning, all normal stages.
- `mixed-economy`: DeepSeek Flash for normalization, evidence, and synthesis; GPT-5.6 Luna for lemmas, proofs, and critique.

Manual deep choices:

- OpenAI: `gpt-5.6-sol`
- DeepSeek: `deepseek-v4-pro`

Normal profiles are limited to 18,000 output tokens. Every per-stage cap is validated between 256 and 5,000 tokens. A deep pass is limited to 5,000 output tokens and is never automatic.

### External research tools

- `lib/tools/literature.ts` queries Crossref and arXiv metadata in parallel, normalizes their responses, strips markup, deduplicates by DOI or normalized title, and returns no more than 12 results.
- `lib/tools/combinatorics.ts` is a deterministic TypeScript graph kernel. It can exhaustively test the triangle-free edge bound through six vertices and returns the Petersen graph for the false cubic-Hamiltonian conjecture.

The evidence stage runs literature search and the bounded computation concurrently. Models never execute arbitrary code and never fetch arbitrary URLs. Researcher source URLs must use public HTTPS; loopback and common private IPv4 ranges are rejected. Full-text downloading is not implemented.

Literature results are cached in D1 for seven days before public metadata services are queried again.

### Claim policy

The only accepted verification states are:

- `source-supported`
- `computation-supported`
- `internally-checked`
- `contested`
- `unverified`

No `proved` state exists. Prompts explicitly state that model agreement is not verification and that no non-formal argument may be described as formally proved.

The orchestrator checks every provider claim before persistence. If a source-supported or computation-supported claim does not reference a recorded evidence ID, it is downgraded to `unverified` and receives an audit warning. A researcher-supplied citation remains unverified unless it matches metadata returned by a literature tool.

### D1 persistence

`db/schema.ts` defines:

- `projects`
- `run_profiles`
- `research_runs`
- `stage_results`
- `claims`
- `evidence`
- `idempotency_records`
- `literature_cache`

The initial schema is in `drizzle/0000_nice_rogue.sql`. The literature-cache addition is in `drizzle/0001_adorable_mordo.sql`. Sites packages these migrations into `dist/.openai/drizzle/` and applies them to the production D1 resource during deployment.

Each stage result records the requested provider/model, returned model, reasoning level, maximum output, provider response ID, prompt version, token categories, tool records, attempt number, deep-pass flag, validated output, and normalized error state.

### WebMCP

The page registers these imperative WebMCP actions:

- `create_research_project`
- `start_dossier_run`
- `get_research_run`

They call the same authenticated APIs as the visible UI and dispatch a refresh event after mutations. Registration, schemas, annotations, and production availability were verified in the in-app browser. Authenticated mutation calls were not invoked during verification because that would create production records.

## Exact implementation sequence used

1. Initialized the portable Sites React/TypeScript starter in the empty workspace.
2. Installed dependencies from the starter lockfile.
3. Added KaTeX and its TypeScript definitions.
4. Registered one private Site and saved its opaque project ID in `.openai/hosting.json`.
5. Declared the D1 binding as `DB`; R2 was left disabled.
6. Built the journal/laboratory workspace and showed the first meaningful local preview.
7. Added the provider-neutral types, schemas, providers, prompts, orchestration, tools, persistence, and APIs.
8. Generated and inspected both D1 migrations.
9. Applied the migrations to the local preview database.
10. Added the project editor, provider-profile editor, stage controls, audit UI, source ledger, dossier, KaTeX, print CSS, and WebMCP registration.
11. Added mocked provider-contract, schema/profile, Mantel, and Petersen tests.
12. Ran tests, TypeScript checking, ESLint, and the production build successfully.
13. Inspected the local site in the in-app browser, corrected the KaTeX input, checked the problem/profile panels, confirmed WebMCP registration, and found no browser console errors.
14. Initialized a Git repository inside this project so no unrelated parent repository could be committed.
15. Committed and pushed the exact source revision to the private Sites repository using a short-lived, per-command credential that was not stored in files or Git configuration.
16. Packaged the validated `dist` output and D1 migrations into the deployment archive.
17. Saved version 1 and deployed it through the owner-private Sites operation.
18. Verified the production URL, signed-in owner identity, rendered workspace, and production WebMCP registration.
19. Stopped the local development server after deployment.

## Reproducing locally

Prerequisites:

- Node.js 22.13 or later
- npm
- Git only if publishing

From the project directory:

```sh
npm install
npm run dev
```

Open <http://localhost:5173/signin-with-chatgpt?return_to=/>. The portable starter provides a local-only mock identity. Hosted sign-in is owned by Sites and must not be reimplemented.

To generate migrations after editing `db/schema.ts`:

```sh
npm run db:generate
npm run build
```

Apply each new migration in order to the local database, replacing the migration filename as appropriate:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nice_rogue.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_adorable_mordo.sql
```

Do not replay an already-applied local migration.

## Validation status

The last completed validation passed:

- `npm test`: 11 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Local visual and interaction inspection: passed.
- Local browser console error inspection: passed.
- Production page load and owner identity: passed.
- Production WebMCP registration: passed.

The tests cover both provider contracts through deterministic mocks, normalized usage and errors, malformed provider output, reviewed model discovery, public-source URL validation, invalid claim labels, run-profile caps, Mantel's theorem finite checks, and the Petersen graph counterexample.

## Secrets and deployment configuration

The application expects these production variables:

- `DEEPSEEK_API_KEY`: secret; enables DeepSeek models.
- `OPENAI_API_KEY`: secret; enables OpenAI models.
- `CROSSREF_MAILTO`: optional non-secret; identifies the application politely to Crossref.

Configure keys only as Sites production secrets. Never add them to `.env` files that may be committed, D1, browser storage, run profiles, API responses, or `.openai/hosting.json`.

After changing production environment variables, deploy a saved version so the new environment revision is active. At least `DEEPSEEK_API_KEY` is recommended first because DeepSeek Economy is the default credit-conserving profile.

## Important invariants for the next agent

- Never automatically switch providers.
- Never automatically retry a paid model call.
- Never start a deep pass without an explicit researcher action.
- Never treat agreement between agents or providers as verification.
- Never add a `proved` claim state without formal verification infrastructure.
- Never expose provider keys or allow arbitrary provider base URLs.
- Never allow model-generated arbitrary code or arbitrary URL fetching.
- Require idempotency keys for stage mutations, run creation, deep passes, and project/profile creation.
- Check the signed-in owner on every project, profile, run, stage, claim, and evidence access.
- Persist a stage before advancing the run.
- Preserve completed stages and researcher input through failures and cancellation.
- Keep deep-pass results separate from normal results.
- Preserve returned model IDs and exact provider-reported usage.
- Keep all report rendering provider-neutral.
- Keep the Site private unless the owner explicitly requests an audience change.

## Known limitations and honest next work

- Provider keys are not configured in production, so a real dossier cannot run yet.
- No live provider request has been made. After configuring each key, run only one short structured smoke request before spending credits on a full benchmark.
- The provider interface supports tool-result continuation, but the current evidence workflow runs the approved literature and computation tools directly before the evidence model call. Provider-originated function-call loops can be expanded later without moving tool implementation into providers.
- Literature search covers only Crossref, arXiv, and researcher-supplied metadata. There is no unrestricted web research or full-text paper retrieval.
- The graph kernel is intentionally small and bounded. General graph-property expansion should remain deterministic and reviewed.
- The UI currently exposes one optional researcher source editor even though the schema accepts up to 20 sources. A multi-source editor is a straightforward next improvement.
- Stage attempts are preserved and visible, but the central UI currently sends reroute choices using the economy model for the selected provider.
- Formal proof assistants, collaboration, paper uploads, arbitrary endpoints, autonomous publication, and novelty claims remain outside milestone one.
- Estimated currency cost is not shown because no versioned pricing configuration has been added. Exact provider-reported tokens are shown.

## Recommended next milestone order

1. Configure only `DEEPSEEK_API_KEY` and run a minimal structured smoke test.
2. Create the Mantel benchmark project and run DeepSeek Economy end to end.
3. Create “Every 3-regular graph is Hamiltonian” and verify that the Petersen graph record keeps the conjecture contested.
4. Add a fabricated user citation and verify that it remains unverified.
5. Configure `OPENAI_API_KEY` only when OpenAI Economy, Mixed Economy, or Sol deep passes are needed.
6. Run one minimal OpenAI structured smoke test.
7. Add integration fixtures around the full persisted transition sequence and idempotent replay.
8. Add multi-source editing and claim selection in the audit lens.
9. Add a versioned pricing table only if estimated currency display is desired.
10. Consider additional reviewed adapters such as Anthropic, Google, or local models without adding arbitrary user-defined endpoints.

## Copy-paste prompt for the next coding agent

Use this when handing the repository to another agent:

> Continue the Axiom private mathematics-research workspace in this repository. First read `IMPLEMENTATION_HANDOFF.md`, `HOW_TO_USE.md`, `.openai/hosting.json`, `lib/research-types.ts`, `lib/providers/types.ts`, `lib/orchestrator.ts`, and `db/schema.ts`. Preserve all invariants in the handoff, especially explicit provider selection, no automatic paid retry or fallback, application-owned stage schemas, owner checks, idempotent mutations, bounded external tools, and the five claim statuses. Inspect the current worktree before editing and do not undo existing work. Run mocked tests before any opt-in live smoke test. Do not consume provider credits unless I explicitly authorize the live call and its provider/model/output cap. Keep the Site private and use the existing Sites project ID rather than creating another Site.

