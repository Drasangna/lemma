"use client";

import {
  BrainCircuit,
  CircleDashed,
  FlaskConical,
  Gauge,
  GitBranch,
  Library,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SAMPLE_PROJECT, type ProjectDraft, type Workspace } from "./use-workspace";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function Topbar({ ws, user }: { ws: Workspace; user: { displayName: string; email: string } }) {
  const exportPdf = () => {
    ws.setTab("report");
    // Wait a frame for the dossier tab to render before the print dialog captures the page.
    setTimeout(() => window.print(), 80);
  };
  return (
    <header className="topbar">
      <div className="brand-mark" aria-hidden="true">
        L
      </div>
      <div>
        <p className="eyebrow">Lemma</p>
        <p className="brand-subtitle">Research workspace</p>
      </div>
      <div className="topbar-center">
        <span className="status-dot" /> Private workspace · {user.displayName}
      </div>
      <div className="topbar-actions">
        <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={exportPdf}>
          <Printer /> Export PDF
        </Button>
        <div className="avatar" title={user.email}>
          {initials(user.displayName)}
        </div>
      </div>
    </header>
  );
}

const PROFILE_ICONS = [Gauge, BrainCircuit, GitBranch];

export function ProjectRail({ ws }: { ws: Workspace }) {
  const listed: ProjectDraft[] = ws.projects.length ? ws.projects : [SAMPLE_PROJECT];
  return (
    <aside className="project-rail">
      <div className="rail-heading">
        <span>Research files</span>
        <Button variant="ghost" size="icon-sm" aria-label="Create research file" onClick={ws.newProject}>
          <Plus />
        </Button>
      </div>
      {listed.map((item, index) => {
        const active = ws.project.id === item.id || (!ws.project.id && index === 0);
        return (
          <button
            key={item.id ?? "sample"}
            className={`project-item ${active ? "active" : ""}`}
            onClick={() => item.id && void ws.selectProject(item)}
          >
            <span className={`project-glyph ${index ? "muted" : ""}`}>{item.title[0]}</span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.id ? "Saved research file" : "Interactive benchmark"}</small>
            </span>
          </button>
        );
      })}

      <div className="rail-rule" />
      <p className="rail-label">Run profiles</p>
      {ws.profiles.map((profile, index) => {
        const Icon = PROFILE_ICONS[index % PROFILE_ICONS.length];
        return (
          <button
            key={profile.id}
            className="plain-item"
            onClick={() => ws.selectProfile(profile.id)}
            disabled={Boolean(ws.bundle)}
          >
            <Icon /> {profile.name}
          </button>
        );
      })}

      <div className="credit-card">
        <div>
          <span>Run allowance</span>
          <strong>
            {ws.tokensUsed.toLocaleString()} / {ws.tokenLimit.toLocaleString()}
          </strong>
        </div>
        <Progress value={Math.min(100, (ws.tokensUsed / ws.tokenLimit) * 100)} />
        <p>Limits stop work at stage boundaries. Deep passes always require an explicit action.</p>
      </div>
    </aside>
  );
}

export function AuditPanel({ ws }: { ws: Workspace }) {
  const coverage = ws.claims.length ? Math.round((ws.supported / ws.claims.length) * 100) : 0;
  const selected = ws.claims[0];
  return (
    <aside className="audit-panel">
      <div className="audit-heading">
        <div>
          <p className="eyebrow">AUDIT LENS</p>
          <h2>Claim provenance</h2>
        </div>
        <ShieldCheck />
      </div>
      <div className="audit-score">
        <div className="score-ring">{coverage}%</div>
        <div>
          <strong>Evidence coverage</strong>
          <p>
            {ws.supported} of {ws.claims.length} claims are supported or internally checked.
          </p>
        </div>
      </div>
      <div className="audit-rule" />

      <p className="rail-label">SELECTED CLAIM</p>
      <blockquote>{selected?.text ?? "Select or generate a claim to inspect its evidence chain."}</blockquote>
      <div className="claim-status">
        <Badge className={`status-${selected?.verificationStatus ?? "unverified"}`}>
          {(selected?.verificationStatus ?? "unverified").toUpperCase()}
        </Badge>
        <span>Never a formal proof label</span>
      </div>

      <div className="evidence-chain">
        <p className="rail-label">EVIDENCE CHAIN</p>
        <ChainStep
          icon={<Library />}
          title="Literature metadata"
          note="Crossref, arXiv, or researcher supplied"
        />
        <ChainStep icon={<FlaskConical />} title="Finite verification" note="Bounded and reproducible" />
        <ChainStep
          icon={<CircleDashed />}
          title="Formal verification"
          note="Outside this milestone"
          warning
        />
      </div>

      {ws.deepModels.map((model, index) => (
        <Button
          key={model.id}
          variant={index === 0 ? "default" : "outline"}
          className={index === 0 ? "deep-button" : "deep-alt"}
          disabled={!ws.bundle || ws.busy}
          onClick={() => void ws.deepen(model.id)}
        >
          <Sparkles /> Deepen with {model.label}
        </Button>
      ))}
      <p className="deep-note">Each deep pass is separate and limited to 5,000 output tokens.</p>

      <div className="provider-status">
        <p className="rail-label">MODEL ACCESS</p>
        <div>
          <span className={ws.models.configured ? "status-dot" : "offline-dot"} />
          {ws.models.provider}
          <small>{ws.models.configured ? "configured" : "OPENROUTER_API_KEY required"}</small>
        </div>
      </div>
    </aside>
  );
}

function ChainStep({
  icon,
  title,
  note,
  warning,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  warning?: boolean;
}) {
  return (
    <div>
      <span className={`chain-icon ${warning ? "warning" : ""}`}>{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
    </div>
  );
}
