# Axiom Research Workspace

A private, provider-neutral workspace for auditable AI-assisted combinatorics research. Axiom persists a six-stage investigation, normalizes every provider response into application-owned schemas, keeps literature and computation tools outside model providers, and produces a print-ready dossier with claim-level provenance.

## Documentation

- [`HOW_TO_USE.md`](HOW_TO_USE.md) — researcher and operator guide.
- [`IMPLEMENTATION_HANDOFF.md`](IMPLEMENTATION_HANDOFF.md) — complete architecture, implementation sequence, deployment notes, invariants, limitations, and next-agent prompt.

## Supported providers

- OpenAI Responses API: `gpt-5.6-luna` and manual `gpt-5.6-sol` deep passes
- DeepSeek Responses API: `deepseek-flash` and manual `deepseek-v4-pro` deep passes

Set `OPENAI_API_KEY` and/or `DEEPSEEK_API_KEY` as server-side deployment secrets. Provider keys are never stored in D1 or returned to the browser. `CROSSREF_MAILTO` is an optional non-secret courtesy identifier for Crossref requests.

## Local development

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Use `/signin-with-chatgpt?return_to=/` in the portable local preview to enable the mock private researcher identity. Generate D1 migrations with `npm run db:generate`, then apply the files in `drizzle/` to the local `DB` binding.

## Verification

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Live provider smoke tests are intentionally opt-in and should be limited to one short structured response per configured provider.
