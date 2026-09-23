# How to use Lemma

Lemma helps a mathematician organize an AI-assisted investigation — in any field, from combinatorics to analysis to number theory — without ever presenting model agreement as proof. It records every stage, model, tool result, token count, warning, and unresolved gap — so you can trust the parts that are checked and stay skeptical of the parts that aren't.

This guide assumes no software background. If you can open a terminal and copy-paste a command, you can run this.

## 1. Install the prerequisites

You need [Node.js](https://nodejs.org) version 22.13 or later. To check whether you already have it, open a terminal and run:

```sh
node --version
```

If that prints `v22.13.0` or higher, you're set. Otherwise, download and install Node.js from [nodejs.org](https://nodejs.org) (the "LTS" button is fine), then check again.

## 2. Get an OpenRouter key

Lemma reaches every AI model — OpenAI, DeepSeek, and others — through a single gateway called [OpenRouter](https://openrouter.ai). You only need one key, and OpenRouter lets you set a spending limit so you can't be surprised by a bill.

1. Go to <https://openrouter.ai> and create an account.
2. Open <https://openrouter.ai/keys> and create a new key.
3. Copy the key somewhere safe — you'll paste it in the next step.

You do not need separate OpenAI or DeepSeek accounts.

## 3. Install and start Lemma

In a terminal, navigate to this project folder and run:

```sh
npm install
```

This downloads the project's dependencies — it can take a minute the first time.

Next, create your personal settings file:

```sh
cp .env.example .env.local
```

Open `.env.local` in any text editor and paste your OpenRouter key after `OPENROUTER_API_KEY=`, so the line looks like:

```
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
```

Save the file. This file is never uploaded or shared anywhere — it's your local secret.

Now start the app (the local database creates itself the first time it is used):

```sh
npm run dev
```

Open <http://localhost:3000> in your browser. The workspace loads immediately — there's no sign-in step, since this runs only on your own computer.

To stop the app later, go back to the terminal and press `Ctrl+C`. To use it again, just run `npm run dev` again from the project folder.

## 4. Create a research file

1. Press the plus button next to **Research files**.
2. Open the **Problem specification** tab.
3. Enter a clear title and the mathematical statement you're investigating. LaTeX works between dollar signs — for example `$e(G) \le n^2/4$` — and is typeset for you.
4. Enter the **Field** — any area of mathematics (e.g. "combinatorics," "number theory," "analysis"). This is descriptive text, not a fixed list.
5. Choose a **Mode**: **Prove from scratch** if you're starting from an open conjecture, or **Expand an existing proof** if you already have a proof and want Lemma to find supporting sources and propose generalizations or corollaries.
6. Enter definitions, one per line.
7. Enter assumptions, one per line.
8. Enter known results, one per line — distinguish facts you know from results you merely suspect.
9. In **Expand an existing proof** mode, paste your existing proof or argument into the **Existing proof** field that appears — Lemma treats this as given context, not something to re-derive.
10. If your field is combinatorics or graph theory, set the minimum and maximum vertex bounds — the built-in computation engine can exhaustively check small graphs (the triangle-free benchmark below works through 6 vertices). This step only appears for combinatorics/graph-flavored fields; other fields rely on literature search alone for now.
11. Optionally add any number of citations with **Add source**: a title, a public `https://` URL, and a pasted abstract or note.
12. Select **Create research file**.

Private-network, local, and non-HTTPS source URLs are rejected. A citation you paste in yourself is not automatically treated as verified — see the labels below.

## 5. Choose a run profile

Before starting a run, pick a profile:

- **DeepSeek Economy** — DeepSeek's chat model, low reasoning, for every stage. Cheapest starting point.
- **OpenAI Economy** — an OpenAI model, low reasoning, for every stage.
- **Mixed Economy** — DeepSeek for normalization/evidence/synthesis, OpenAI for lemmas/proofs/critique.

The selected profile and its maximum output allowance appear above the start button. A normal run is capped at 18,000 output tokens total.

To build your own profile:

1. Open **Run profiles**.
2. Give it a name and a total output-token limit.
3. For each stage, choose the model, reasoning level, and per-stage output cap.
4. Select **Save profile**, then return to **Research run** and choose it.

Lemma never silently changes these assignments or substitutes a different model on its own.

## 6. Run the investigation

Select **Start dossier run**. This does not call a model yet — it only saves your chosen profile as a snapshot for this run.

You then have two choices:

- **Advance one stage** runs only the next stage, so you can review each result before continuing.
- **Run remaining** proceeds through the rest of the stages automatically, one persisted request at a time.

The six stages are the same in both modes, but what each stage is asked to do adapts to your chosen **Mode**:

1. Problem normalization.
2. Literature metadata and bounded computation.
3. In **Prove from scratch** mode: candidate lemmas toward a proof. In **Expand an existing proof** mode: generalizations, corollaries, and related conjectures suggested by your supplied proof.
4. In **Prove from scratch** mode: two independent proof strategies for the original statement. In **Expand an existing proof** mode: attempts at the identified generalizations/corollaries, and/or gaps found in your supplied proof.
5. Adversarial critique and counterexample search.
6. Dossier synthesis.

Each stage is validated and saved to your local database before the next one begins. You can close the browser and come back later — the run picks up exactly where it left off.

## 7. Control what you spend

- Review the selected profile and allowance before starting.
- Use **Advance one stage** when you want maximum control over spending.
- Exact token usage appears on each completed stage and in the running total.
- A run stops before any stage whose configured cap would exceed your allowance.
- Nothing retries automatically. Nothing switches models automatically. A deep pass never starts automatically.

## 8. Handle cancellation or failure

Select **Cancel** to stop a run — completed stages stay saved.

If a stage fails (a bad key, a rate limit, an invalid response), the failed attempt is recorded and the run pauses there. You can then:

- Select **Retry same model** to try that stage again with the same model.
- Select **Reroute to \<model name\>** to explicitly try a different configured model instead.

Rerouting can use a different model's quota. Lemma never infers permission to switch models from a failure — you always choose explicitly.

## 9. Run a deeper critique

Once a run exists, the audit panel on the right offers one or more **Deepen with \<model\>** buttons (these are the higher-capability models Lemma designates as "deep").

A deep pass:

- is a deliberate, manual action you choose to spend more on;
- is capped at 5,000 output tokens;
- produces a separate result that never overwrites the original stage;
- can use any configured model, regardless of which model ran the original stage.

## 10. Read the evidence and audit labels

Open **Sources** to see stage summaries, normalized artifacts, and exactly which model produced what.

Every claim gets exactly one of five labels:

- **source-supported** — the claim points to a recorded literature source.
- **computation-supported** — the claim points to a recorded bounded computation.
- **internally-checked** — the argument received internal logical review, but no formal proof verification.
- **contested** — a critique, counterexample, or unresolved disagreement challenges it.
- **unverified** — there isn't enough recorded support yet.

There is no "proved" label, on purpose. Two models agreeing is not evidence. A computation checked up to 6 vertices does not prove a statement for all n. No non-formal argument is ever presented as a formal proof — that's the whole point of this tool.

The **Audit lens** on the right shows overall evidence coverage and lets you inspect a claim's provenance chain. On narrow screens this panel is hidden so the main investigation stays usable.

## 11. Export the dossier as a PDF

1. Open **Dossier** once one or more stages have completed.
2. Review the problem statement, stage summaries, claims, warnings, and open questions.
3. Select **Export PDF**.
4. Choose **Save as PDF** in your browser's print dialog.

Equations render properly in the exported document.

## Suggested first projects

### Mantel benchmark

Statement:

> If `G` is a triangle-free graph on `n` vertices, then `e(G) ≤ floor(n²/4)`.

Use a maximum bound of 6 vertices. The computation should find no counterexample within that bound, and the claim should read `computation-supported` rather than `proved`.

### Petersen counterexample benchmark

Statement:

> Every 3-regular graph is Hamiltonian.

The computation engine should surface the Petersen graph as a 10-vertex counterexample, and the claim should stay `contested` — never `proved` or silently accepted.

### Fabricated-citation benchmark

Add a made-up citation with a plausible-looking `https://` URL. Lemma should not treat it as `source-supported` unless it actually matches literature metadata it looked up itself.

## Advanced: using an AI agent to drive Lemma

If your browser supports WebMCP, the page exposes three tools an AI agent can call directly: `create_research_project`, `start_dossier_run`, and `get_research_run`. An agent can create a structured project and start a run with an explicit built-in profile, using the same local API the visible interface uses. Starting a run this way never advances a paid stage automatically — you still choose when a stage actually runs a model.

## Troubleshooting

**The start button is disabled.** No `OPENROUTER_API_KEY` is set. Add it to `.env.local` and restart `npm run dev`.

**A stage reports "not configured."** The key is missing or invalid. Double-check `.env.local`, then restart the dev server (environment changes require a restart).

**A stage stops at the output limit.** The next stage's cap would exceed your profile's total allowance. Edit the profile to raise the limit, or start a fresh run.

**A citation stays unverified.** Expected for anything you typed in yourself that Lemma's own literature search didn't independently confirm.

**A proof attempt isn't labeled "proved."** Intentional — formal proof verification is outside what this tool does.

**I closed the browser mid-run.** No problem — reopen the same research file. Completed stages are saved locally and the run resumes at its next stage.

## Safety rules for researchers

- Don't put API keys, passwords, private correspondence, or personal information into problem statements or sources.
- Treat every generated proof attempt as a proposal that still needs your mathematical review.
- Read the warnings and open questions before citing any result elsewhere.
- Reproduce computational evidence yourself from the recorded bounds and algorithm version before relying on it.
- Verify bibliographic metadata against the actual paper before publishing anything.
- Don't make novelty or priority claims based solely on this tool's output.
