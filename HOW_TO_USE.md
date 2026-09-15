# How to use Axiom

Axiom helps a mathematician organize an AI-assisted combinatorics investigation without presenting model agreement as proof. It records every stage, model, tool result, token count, warning, and unresolved gap.

## Before your first run

Open the private workspace:

<https://axiom-research-workspace.karabhi2007.chatgpt.site>

Sign in with the ChatGPT account that owns the deployment.

The deployment operator must configure at least one server-side provider secret:

- `DEEPSEEK_API_KEY` for DeepSeek Economy and DeepSeek Pro.
- `OPENAI_API_KEY` for OpenAI Economy, Mixed Economy, and Sol.

Do not paste provider keys into a problem, source, profile, browser field, or chat message. They belong in the Site's production secret settings. When a provider is unavailable, the audit panel says `secret required` and model-backed runs remain disabled.

DeepSeek Economy is the default and is the best starting point when conserving OpenAI credits.

## Create a research file

1. Press the plus button next to **Research files**.
2. Open **Problem specification**.
3. Enter a clear title and mathematical statement.
4. Enter definitions, one per line.
5. Enter assumptions, one per line.
6. Enter known results, one per line. Distinguish facts you know from results you merely suspect.
7. Set the finite minimum and maximum vertex bounds. The current deterministic kernel exhaustively enumerates the triangle-free benchmark through six vertices.
8. Optionally add a citation title, public HTTPS URL, and pasted abstract or note.
9. Select **Create research file** or **Save changes**.

Private-network, loopback, local, and non-HTTPS source URLs are rejected. A user-supplied citation is not automatically verified.

## Choose a run profile

Select a profile before creating the run:

- **DeepSeek Economy** uses `deepseek-flash` with low reasoning for every normal stage.
- **OpenAI Economy** uses `gpt-5.6-luna` with low reasoning for every normal stage.
- **Mixed Economy** uses DeepSeek for normalization, evidence, and synthesis and OpenAI for lemmas, proofs, and criticism.

The selected profile and maximum output allowance appear above the start button. A normal run is capped at 18,000 output tokens.

To create a private custom profile:

1. Open **Run profiles**.
2. Give the profile a unique name.
3. Set the total output-token limit.
4. Choose the provider, exact configured model, reasoning level, and output cap for each stage.
5. Select **Save profile**.
6. Return to **Research run** and choose the saved profile.

Axiom never silently changes these assignments.

## Run the investigation

Select **Start dossier run**. Creating the run does not call a provider; it only saves the chosen profile snapshot.

You then have two choices:

- **Advance one stage** runs only the next stage.
- **Run remaining** proceeds through the remaining stages by making one persisted stage request at a time.

The stages are:

1. Problem normalization.
2. Literature metadata and bounded computation.
3. Candidate lemmas and conjecture refinements.
4. Two independent proof strategies.
5. Adversarial criticism and counterexample search.
6. Dossier synthesis.

Each stage is validated and saved before the next one begins. You can close the browser and return later; the latest run for the selected research file resumes from its stored boundary.

## Control credit use

- Review the selected profile and allowance before starting.
- Use **Advance one stage** when you want maximum control.
- Exact provider-reported output usage appears in completed stage rows and in the run allowance.
- Cached and reasoning token categories are stored with the run even when the compact UI does not display every category simultaneously.
- A run stops before a stage whose configured maximum would exceed the run allowance.
- A retry never happens automatically.
- A provider reroute never happens automatically.
- A deep pass never happens automatically.
- Currency cost is not estimated because no versioned pricing table is configured.

## Handle cancellation or failure

Select **Cancel** to stop the run. Completed stages remain stored.

If a provider fails, the failed attempt is preserved and the run stops at the current stage. You may then:

- Select **Retry same model** to repeat that stage with the same assignment.
- Select **Reroute to DeepSeek** or **Reroute to OpenAI** to make an explicit economy-model reroute.

Rerouting can consume credits from the newly selected provider. Axiom does not infer permission from another provider's failure.

Authentication errors, rate limits, quota exhaustion, timeouts, content filters, invalid structured output, and general upstream failures are normalized into auditable failure records.

## Run a deeper critique

After a run exists, the audit panel offers:

- **Deepen with Sol** using `gpt-5.6-sol`.
- **Deepen with DeepSeek Pro** using `deepseek-v4-pro`.

A deep pass:

- is a deliberate paid action;
- is limited to 5,000 output tokens;
- produces a separate result;
- does not overwrite the original stage;
- may use either supported provider regardless of the original provider.

## Read the evidence and audit labels

Open **Sources** to inspect stage summaries, normalized artifacts, provider/model provenance, and recorded metadata.

The five labels mean:

- **source-supported**: the claim references a recorded literature source.
- **computation-supported**: the claim references a recorded bounded experiment.
- **internally-checked**: the argument received internal logical checking but no formal proof verification.
- **contested**: a critic, counterexample search, or unresolved disagreement challenges it.
- **unverified**: there is not enough recorded support.

These labels are deliberately conservative. Agreement between providers is not evidence. A finite computation is not a general proof. No non-formal proof attempt is labeled proved.

The right-hand **Audit lens** shows evidence coverage and a selected claim's provenance chain. On narrower screens, the audit panel collapses so the investigation remains usable.

## Export the dossier as PDF

1. Open **Dossier** after one or more stages have completed.
2. Review the problem, stage summaries, claims, warnings, unresolved questions, and audit appendix.
3. Select **Export PDF**.
4. Choose **Save as PDF** in the browser print dialog.

The print stylesheet removes workspace controls and keeps text selectable. KaTeX equations remain typeset in the saved document.

## Suggested first validation projects

### Mantel benchmark

Statement:

> If `G` is a triangle-free graph on `n` vertices, then `e(G) ≤ floor(n²/4)`.

Use a maximum bound of six vertices for the current exhaustive kernel. The computation should find no finite counterexample. The literature stage should identify metadata related to Mantel's theorem, while the proof strategies remain non-formal attempts.

### Petersen counterexample benchmark

Statement:

> Every 3-regular graph is Hamiltonian.

The experiment engine should record the Petersen graph as a 10-vertex counterexample and the claim should remain contested or refuted rather than proved.

### Fabricated-citation benchmark

Add an invented citation with a public HTTPS-looking URL and pasted abstract. The system must not turn the user-supplied citation into source-supported evidence unless it matches verified literature metadata.

## Use Axiom through an AI agent

When the browser supports WebMCP, the page exposes:

- `create_research_project`
- `start_dossier_run`
- `get_research_run`

An agent can create a structured project, create a persisted run with an explicit built-in profile, and read run status through the same authenticated server operations used by the visible interface. Starting a run through WebMCP does not automatically advance paid stages.

Example request to an agent:

> Create a private Axiom combinatorics project for the statement “Every 3-regular graph is Hamiltonian,” use a finite bound of 12 vertices, and start it with DeepSeek Economy. Do not advance a model stage yet.

The user should explicitly authorize later stage advancement if it will consume provider credits.

## Troubleshooting

### Start button is disabled

No provider secret is configured. Add the required production key and redeploy the Site.

### A stage reports provider not configured

The selected profile references a provider whose secret is missing. Configure that provider or explicitly reroute the failed stage to a configured provider.

### A stage stops at the output limit

The next stage's configured maximum would exceed the profile's total allowance. Create or edit a profile with a deliberate new limit, then start a new run or use an explicitly supported continuation flow.

### A citation remains unverified

This is expected for researcher-supplied or unmatched metadata. Add a valid DOI/arXiv source or let the evidence stage search public metadata.

### A proof attempt is not labeled proved

This is intentional. Formal proof verification is outside milestone one.

### The browser was closed during a run

Open the same research file. Completed stages are stored in D1, and the latest run resumes at its next stage boundary.

## Safety rules for researchers

- Do not include API keys, passwords, private correspondence, unpublished sensitive data, or personal information in problem statements or sources.
- Treat every generated proof as a proposal requiring mathematical review.
- Inspect warnings and unresolved questions before citing any result.
- Reproduce computational evidence from the recorded bounds and algorithm version.
- Verify bibliographic metadata against the actual paper before publication.
- Do not make novelty or publication claims solely from the dossier.

