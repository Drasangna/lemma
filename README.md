# Lemma

**A private, local research workspace for auditable, AI-assisted mathematics.**

Lemma runs a structured, six-stage investigation over a problem in any mathematical field — normalize, gather evidence, propose lemmas, attempt proofs, critique, synthesize — and persists every stage before the next begins. It supports two modes: proving an open conjecture from scratch, or handing it an existing proof to find supporting sources for and expand upon (generalizations, corollaries, related work). Every claim a model makes is checked against recorded evidence and labeled with one of five honest verification states. There is no `proved` label, on purpose: agreement between models is not proof, and a bounded computation is not a general argument. Lemma's job is to keep the paper trail, not to pretend it did the mathematics for you.

It's a single-user app that runs entirely on your own machine.

## Why

Using a chat window to help with a proof leaves no audit trail: you can't tell which claim came from which model, which claim is backed by a real source versus a plausible-sounding one, or which stage silently contradicted an earlier one. Lemma exists to fix that:

- **Every stage is persisted before the next one runs** — close the browser mid-investigation and pick up exactly where you left off.
- **Every claim carries provenance** — the model, the exact request, the token usage, and whether it's backed by a recorded source, a recorded computation, internal reasoning only, contested, or unverified.
- **Nothing happens automatically that costs money** — no silent retries, no silent model switches, no automatic "deep" passes. You approve every model call explicitly.
- **Bounded, deterministic tools do the actual checking.** A small graph kernel exhaustively verifies finite instances; a literature search hits Crossref and arXiv metadata directly. Models never execute arbitrary code or fetch arbitrary URLs.

## How it works

```
Problem spec ──▶ normalize ──▶ evidence ──▶ lemmas ──▶ proofs ──▶ critique ──▶ synthesis ──▶ dossier
                    │             │
                    │             ├─ literature search (Crossref + arXiv metadata)
                    │             └─ bounded graph computation (deterministic, reproducible)
                    │
              each stage persisted, validated, and claim-checked before the next runs
```

Every model call goes through [OpenRouter](https://openrouter.ai), so one API key reaches OpenAI, DeepSeek, or any other model OpenRouter supports — you choose which model runs which stage, per profile.

## Claim verification labels

Every claim a model produces is checked by the orchestrator, not taken on faith, and gets exactly one label:

| Label | Meaning |
|---|---|
| `source-supported` | Backed by a literature source Lemma actually recorded |
| `computation-supported` | Backed by a bounded computation Lemma actually ran |
| `internally-checked` | Reviewed by the model's own reasoning, no external check |
| `contested` | A critique, counterexample, or disagreement challenges it |
| `unverified` | Not enough recorded support yet |

A claim that says it's source- or computation-supported but doesn't actually reference a recorded evidence ID gets automatically downgraded to `unverified` with a warning — the model doesn't get to grade its own homework.

## Getting started

Requires Node.js 22.13+ and an [OpenRouter](https://openrouter.ai/keys) API key.

```sh
npm install
cp .env.example .env.local     # then add your OPENROUTER_API_KEY
npm run db:migrate
npm run dev
```

Open <http://localhost:3000> — no sign-in, no cloud account, no deployment. Your data lives in a local SQLite file (`./data/lemma.db` by default).

New to the workflow? **[HOW_TO_USE.md](HOW_TO_USE.md)** is a full walkthrough written for a mathematician, not a developer — installing Node, getting a key, creating your first project, reading the audit labels, exporting a dossier.

## Configuration

All configuration lives in `.env.local` (copy it from [`.env.example`](.env.example)):

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | The only credential needed to run any model |
| `CROSSREF_MAILTO` | No | Politely identifies this app to Crossref's API |
| `LEMMA_DB_PATH` | No | Local SQLite file path (defaults to `./data/lemma.db`) |

Keys are read from the server environment only — never written to the database, never returned to the browser.

## Project structure

```
app/                    UI (research workspace, API routes, WebMCP tools)
lib/
  orchestrator.ts       stage transitions, claim verification, persistence
  providers/            the OpenRouter adapter and shared request/error helpers
  tools/                the literature search and bounded graph kernel
  run-profiles.ts       built-in economy/mixed/deep model profiles
db/                     Drizzle schema and local SQLite connection
drizzle/                generated SQL migrations
tests/                  provider contract, schema/profile, and combinatorics tests
```

## Testing

```sh
npm test          # unit tests (mocked providers, schema validation, graph kernel)
npm run lint
npx tsc --noEmit
npm run build
```

Live model calls are opt-in only — nothing in the test suite spends real credits. When you do test against a real key, start with one short, cheap request before running anything larger.

## Further reading

- **[HOW_TO_USE.md](HOW_TO_USE.md)** — the researcher's guide: install, run, and use the workspace end to end.
- **[IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md)** — full architecture, design invariants, and history for whoever picks this up next.
