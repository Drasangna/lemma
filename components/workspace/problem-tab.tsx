"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMBINATORICS_FIELD_PATTERN, type ProblemSpec } from "@/lib/research-types";
import type { ProjectDraft, Workspace } from "./use-workspace";

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function ProblemTab({ ws }: { ws: Workspace }) {
  const { draft, setDraft } = ws;
  const set = (patch: Partial<ProjectDraft>) => setDraft({ ...draft, ...patch });
  const bounds = draft.bounds ?? { minVertices: 1, maxVertices: 7 };

  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">STRUCTURED INPUT</p>
          <h2>Problem specification</h2>
        </div>
        <Button onClick={ws.saveProject} disabled={ws.busy}>
          {ws.project.id ? "Save changes" : "Create research file"}
        </Button>
      </div>

      <div className="form-grid">
        <label>
          Title
          <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          Field
          <Input
            value={draft.field}
            onChange={(e) => set({ field: e.target.value })}
            placeholder="e.g. combinatorics, number theory, analysis"
          />
        </label>
      </div>
      <label>
        Mode
        <Select value={draft.mode} onValueChange={(mode) => set({ mode: mode as ProblemSpec["mode"] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prove">Prove from scratch</SelectItem>
            <SelectItem value="expand">Expand an existing proof</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label>
        Statement <small>(LaTeX works: $x^2$)</small>
        <Textarea rows={6} value={draft.statement} onChange={(e) => set({ statement: e.target.value })} />
      </label>

      <div className="form-grid">
        <label>
          Definitions, one per line
          <Textarea
            rows={5}
            value={draft.definitions.join("\n")}
            onChange={(e) => set({ definitions: lines(e.target.value) })}
          />
        </label>
        <label>
          Assumptions, one per line
          <Textarea
            rows={5}
            value={draft.assumptions.join("\n")}
            onChange={(e) => set({ assumptions: lines(e.target.value) })}
          />
        </label>
      </div>
      <label>
        Known results, one per line
        <Textarea
          rows={4}
          value={draft.knownResults.join("\n")}
          onChange={(e) => set({ knownResults: lines(e.target.value) })}
        />
      </label>

      {draft.mode === "expand" && (
        <label>
          Existing proof
          <Textarea
            rows={8}
            value={draft.existingProof ?? ""}
            onChange={(e) => set({ existingProof: e.target.value })}
            placeholder="Paste the proof or argument you already have. Lemma will find sources for it and propose generalizations."
          />
        </label>
      )}

      {COMBINATORICS_FIELD_PATTERN.test(draft.field) && (
        <div className="bounds-row">
          <label>
            Minimum vertices
            <Input
              type="number"
              min={1}
              max={12}
              value={bounds.minVertices}
              onChange={(e) => set({ bounds: { ...bounds, minVertices: Number(e.target.value) } })}
            />
          </label>
          <label>
            Maximum vertices
            <Input
              type="number"
              min={1}
              max={12}
              value={bounds.maxVertices}
              onChange={(e) => set({ bounds: { ...bounds, maxVertices: Number(e.target.value) } })}
            />
          </label>
        </div>
      )}

      <SourceEditor sources={draft.userSources} onChange={(userSources) => set({ userSources })} />
    </>
  );
}

type Sources = ProblemSpec["userSources"];

/** Researcher-supplied citations. They stay "unverified" unless Lemma's own search finds them. */
function SourceEditor({ sources, onChange }: { sources: Sources; onChange: (sources: Sources) => void }) {
  const update = (index: number, patch: Partial<Sources[number]>) =>
    onChange(sources.map((source, i) => (i === index ? { ...source, ...patch } : source)));

  return (
    <div className="source-editor">
      <p className="section-kicker">OPTIONAL USER SOURCES</p>
      {sources.map((source, index) => (
        <div className="source-entry" key={index}>
          <div className="form-grid">
            <label>
              Source title
              <Input value={source.title} onChange={(e) => update(index, { title: e.target.value })} />
            </label>
            <label>
              HTTPS URL
              <Input
                type="url"
                value={source.url}
                placeholder="https://…"
                onChange={(e) => update(index, { url: e.target.value })}
              />
            </label>
          </div>
          <label>
            Abstract or citation note
            <Textarea
              rows={3}
              value={source.abstract ?? ""}
              onChange={(e) => update(index, { abstract: e.target.value })}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => onChange(sources.filter((_, i) => i !== index))}>
            <X /> Remove source
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...sources, { title: "", url: "https://" }])}
      >
        <Plus /> Add source
      </Button>
    </div>
  );
}
