"use client";

import { Badge } from "@/components/ui/badge";
import { MathText } from "./math-text";
import { STAGE_LABELS } from "./stages";
import type { Workspace } from "./use-workspace";

/** Every stage result with its model, summary, and raw artifacts. */
export function SourcesTab({ ws }: { ws: Workspace }) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">PROVENANCE LEDGER</p>
          <h2>Sources, experiments, and stage artifacts</h2>
        </div>
      </div>
      {!ws.bundle && (
        <div className="empty-state">
          Start a run to populate normalized literature and reproducible experiment records.
        </div>
      )}
      {ws.bundle?.results.map((result) => (
        <article className="artifact-row" key={result.id}>
          <div>
            <Badge variant="outline">
              {result.stage}
              {result.isDeepPass ? " · DEEP PASS" : ""}
            </Badge>
            <span>
              {result.provider} / {result.returnedModel ?? result.requestedModel}
            </span>
          </div>
          <h3>
            <MathText text={result.output?.summary ?? result.error?.message ?? "No validated output"} />
          </h3>
          {result.output?.artifacts.map((artifact) => (
            <details key={artifact.id}>
              <summary>{artifact.title}</summary>
              <p>{artifact.content}</p>
              <pre>{JSON.stringify(artifact.metadata, null, 2)}</pre>
            </details>
          ))}
        </article>
      ))}
    </>
  );
}

/** The printable report: stage summaries, every claim with its verification label, and an audit appendix. */
export function DossierTab({ ws }: { ws: Workspace }) {
  const { project, mainResults } = ws;
  return (
    <>
      <div className="report-title">
        <p className="eyebrow">LEMMA RESEARCH DOSSIER</p>
        <h2>{project.title}</h2>
        <p>
          <MathText text={project.statement} />
        </p>
      </div>
      {mainResults.length === 0 && (
        <div className="empty-state">
          The dossier grows stage by stage. Start the run when the specification is ready.
        </div>
      )}
      {mainResults.map((result, index) => (
        <section className="report-section" key={result.id}>
          <div className="report-section-number">{String(index + 1).padStart(2, "0")}</div>
          <div>
            <p className="section-kicker">
              {result.stage.toUpperCase()} · {result.requestedModel}
            </p>
            <h3>{STAGE_LABELS[result.stage as keyof typeof STAGE_LABELS]}</h3>
            <p>
              <MathText text={result.output?.summary ?? ""} />
            </p>
            {result.output?.claims.map((claim) => (
              <div className="report-claim" key={claim.id}>
                <Badge className={`status-${claim.verificationStatus}`}>{claim.verificationStatus}</Badge>
                <span>
                  <MathText text={claim.text} />
                </span>
                {claim.warnings.map((warning) => (
                  <small key={warning}>{warning}</small>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
      {mainResults.length > 0 && (
        <section className="audit-appendix">
          <h3>Audit appendix</h3>
          <p>
            Claims: {ws.claims.length} · Evidence-linked or internally checked: {ws.supported} · Output usage:{" "}
            {ws.tokensUsed.toLocaleString()} tokens.
          </p>
          <p>
            No model agreement is treated as verification. No non-formal argument is labeled as a formal
            proof.
          </p>
        </section>
      )}
    </>
  );
}
