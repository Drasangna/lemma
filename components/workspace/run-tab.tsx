"use client";

import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  CircleStop,
  FlaskConical,
  Library,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMBINATORICS_FIELD_PATTERN, stageIds } from "@/lib/research-types";
import { STAGE_LABELS, STAGE_NOTES } from "./stages";
import type { Workspace } from "./use-workspace";

type StageState = "done" | "failed" | "active" | "ready" | "waiting";

export function RunTab({ ws }: { ws: Workspace }) {
  const { bundle, busy, currentStage, runState, currentProfile } = ws;

  const inProgress = bundle && currentStage < stageIds.length && runState !== "cancelled";

  return (
    <>
      <div className="run-header">
        <div>
          <p className="section-kicker">
            <span className="status-dot" /> {runState.toUpperCase()}
          </p>
          <h2>
            {bundle
              ? STAGE_LABELS[stageIds[Math.min(currentStage, stageIds.length - 1)]]
              : "Ready for investigation"}
          </h2>
          <p>Each stage is validated and persisted before the next provider call.</p>
        </div>
        <div className="profile-control">
          <label htmlFor="run-profile">Run profile</label>
          <Select value={ws.profileId} onValueChange={ws.selectProfile} disabled={Boolean(bundle)}>
            <SelectTrigger id="run-profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ws.profiles.map((profile) => (
                <SelectItem value={profile.id} key={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="preflight">
        <div>
          <strong>{currentProfile.name}</strong>
          <span>
            {currentProfile.stages.normalize.model} → {currentProfile.stages.synthesis.model}
          </span>
        </div>
        <div>
          <strong>{currentProfile.totalOutputLimit.toLocaleString()}</strong>
          <span>maximum output tokens</span>
        </div>
        <div>
          <strong>{ws.models.configured ? "Ready" : "—"}</strong>
          <span>{ws.models.configured ? "OpenRouter configured" : "set OPENROUTER_API_KEY"}</span>
        </div>
      </div>

      <div className="run-actions">
        {!bundle && (
          <Button onClick={ws.startRun} disabled={busy || !ws.models.configured}>
            <Play /> Start dossier run
          </Button>
        )}
        {inProgress && (
          <>
            <Button onClick={ws.advanceOne} disabled={busy}>
              <ChevronRight /> Advance one stage
            </Button>
            <Button variant="outline" onClick={ws.runRemaining} disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : <Play />} Run remaining
            </Button>
            <Button variant="ghost" onClick={ws.cancelRun}>
              <CircleStop /> Cancel
            </Button>
          </>
        )}
        {bundle?.run.status === "failed" && (
          <>
            <Button variant="outline" onClick={ws.advanceOne} disabled={busy}>
              <RotateCcw /> Retry same model
            </Button>
            {ws.economyModels.map((model) => (
              <Button
                key={model.id}
                variant="ghost"
                onClick={() => void ws.reroute(model.id)}
                disabled={busy}
              >
                Reroute to {model.label}
              </Button>
            ))}
          </>
        )}
        {runState === "cancelled" && (
          <span className="boundary-note">
            <Pause /> Cancelled; completed results remain stored.
          </span>
        )}
      </div>

      <div className="stage-list">
        {stageIds.map((stage, index) => {
          const result = [...ws.mainResults].reverse().find((r) => r.stage === stage);
          const state: StageState =
            result?.status === "failed"
              ? "failed"
              : result?.status === "completed"
                ? "done"
                : busy && index === currentStage
                  ? "active"
                  : bundle && index === currentStage
                    ? "ready"
                    : "waiting";
          return (
            <div className={`stage-row ${state}`} key={stage}>
              <div className="stage-number">
                {state === "done" ? (
                  <CircleCheck />
                ) : state === "active" ? (
                  <CircleDashed />
                ) : state === "failed" ? (
                  <AlertTriangle />
                ) : (
                  index + 1
                )}
              </div>
              <div className="stage-copy">
                <strong>{STAGE_LABELS[stage]}</strong>
                <span>
                  {result
                    ? `${result.requestedModel} · ${(result.usage.outputTokens ?? 0).toLocaleString()} output tokens${result.attempt > 1 ? ` · attempt ${result.attempt}` : ""}`
                    : STAGE_NOTES[stage]}
                </span>
              </div>
              {state === "active" && <Progress value={54} className="stage-progress" />}
              {result?.output && (
                <button
                  className="inspect-link"
                  onClick={() => ws.setTab(stage === "synthesis" ? "report" : "sources")}
                >
                  Inspect <ChevronRight />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <EvidenceCards ws={ws} />
    </>
  );
}

function EvidenceCards({ ws }: { ws: Workspace }) {
  const { evidenceResult, project } = ws;
  const hasKernel = COMBINATORICS_FIELD_PATTERN.test(project.field);
  return (
    <div className="evidence-grid">
      <article className="evidence-card">
        <div className="card-icon">
          <Library />
        </div>
        <div className="card-heading">
          <span>Literature scout</span>
          <Badge className="status-source-supported">SOURCE-SUPPORTED</Badge>
        </div>
        <h3>
          {evidenceResult?.output?.artifacts.find((a) => a.type === "source")?.title ??
            "Crossref and arXiv metadata search"}
        </h3>
        <p>
          {evidenceResult?.output?.summary ??
            "The evidence stage searches cached public metadata before asking a model to interpret the results."}
        </p>
        <div className="source-row">
          <BookOpen />
          <span>
            <strong>Metadata-only research</strong>
            <small>HTTPS sources · deduplicated · maximum 12</small>
          </span>
          <ChevronRight />
        </div>
      </article>

      <article className="evidence-card">
        <div className="card-icon">
          <FlaskConical />
        </div>
        <div className="card-heading">
          <span>Experiment engine</span>
          <Badge className="status-computation-supported">COMPUTATION-SUPPORTED</Badge>
        </div>
        <h3>
          {!hasKernel
            ? "No computation kernel for this field yet"
            : evidenceResult
              ? "Bounded deterministic experiment recorded"
              : `Ready to enumerate through n = ${project.bounds?.maxVertices ?? 6}`}
        </h3>
        <p>
          {hasKernel
            ? "No generated code is executed. The reproducible graph kernel records its algorithm version, parameters, witness, and result."
            : "Evidence for this field comes from literature search alone. New kernels can be registered in lib/tools."}
        </p>
      </article>
    </div>
  );
}
