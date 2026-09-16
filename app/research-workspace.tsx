"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import {
  AlertTriangle, BookOpen, BrainCircuit, ChevronRight, CircleCheck, CircleDashed,
  CircleStop, FlaskConical, Gauge, GitBranch, Library, LoaderCircle, MoreHorizontal,
  Pause, Play, Plus, Printer, RotateCcw, Search, ShieldCheck, Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BUILT_IN_PROFILES } from "@/lib/run-profiles";
import type { ModelRef, ProblemSpec, RunProfile, StageOutput } from "@/lib/research-types";
import { WebMcpRegistration } from "./webmcp";

const stageIds = ["normalize", "evidence", "lemmas", "proofs", "critique", "synthesis"] as const;
const stageLabels: Record<(typeof stageIds)[number], string> = {
  normalize: "Problem normalized", evidence: "Literature & experiments", lemmas: "Candidate lemmas",
  proofs: "Proof strategies", critique: "Adversarial critique", synthesis: "Dossier synthesis",
};
const stageNotes: Record<(typeof stageIds)[number], string> = {
  normalize: "Definitions and assumptions", evidence: "Metadata plus bounded computation", lemmas: "Evidence-linked candidates",
  proofs: "Two independent approaches", critique: "Counterexamples and gaps", synthesis: "Audit-ready report",
};
const initialProfiles: RunProfile[] = Object.values(BUILT_IN_PROFILES);
const sample: ProblemSpec & { id?: string } = {
  title: "Triangle-free graphs at the extremal boundary", field: "combinatorics",
  statement: "If G is a triangle-free graph on n vertices, then e(G) ≤ floor(n² / 4).",
  definitions: ["G is a finite simple graph.", "A graph is triangle-free when it has no 3-cycle."],
  assumptions: ["n is a positive integer."], knownResults: ["Balanced complete bipartite graphs attain the proposed bound."],
  bounds: { minVertices: 1, maxVertices: 6 }, userSources: [],
};

type Project = ProblemSpec & { id: string; createdAt?: number; updatedAt?: number };
type Usage = { inputTokens?: number; outputTokens?: number; reasoningTokens?: number; cachedTokens?: number; totalTokens?: number };
type ResultRow = { id: string; stage: string; status: string; provider: string; requestedModel: string; returnedModel?: string; attempt: number; isDeepPass: boolean; output: StageOutput | null; usage: Usage; error?: { message?: string; code?: string } | null; toolRecords?: Array<{ name: string; output: unknown }> };
type RunBundle = { run: { id: string; projectId: string; status: string; currentStage: number; outputTokens: number; inputTokens: number; cachedTokens: number; reasoningTokens: number; profileSnapshot: { name: string; totalOutputLimit: number } }; project: Project; results: ResultRow[] };
type ProviderCatalog = { id: string; configured: boolean; models: Array<{ id: string; label: string; deep: boolean }> };

function key(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status})`);
  return body as T;
}
function MathFormula({ expression }: { expression: string }) {
  const html = useMemo(() => katex.renderToString(expression, { throwOnError: false, output: "html" }), [expression]);
  return <span className="formula" aria-label={expression} dangerouslySetInnerHTML={{ __html: html }} />;
}
function splitLines(value: string) { return value.split("\n").map((v) => v.trim()).filter(Boolean); }
function initials(name?: string) { return (name ?? "Researcher").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase(); }

export function ResearchWorkspace({ user }: { user: { displayName: string; email: string } }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | (ProblemSpec & { id?: string })>(sample);
  const [draft, setDraft] = useState(sample);
  const [profileId, setProfileId] = useState("deepseek-economy");
  const [runProfiles, setRunProfiles] = useState<RunProfile[]>(initialProfiles);
  const [profileDraft, setProfileDraft] = useState<RunProfile>({ ...initialProfiles[0], id: "", name: "My research profile", stages: structuredClone(initialProfiles[0].stages) });
  const [bundle, setBundle] = useState<RunBundle | null>(null);
  const [providers, setProviders] = useState<ProviderCatalog[]>([]);
  const [tab, setTab] = useState("run");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stopRef = useRef(false);

  const loadRun = useCallback(async (id: string) => {
    const next = await api<RunBundle>(`/api/runs/${id}`);
    setBundle(next); setProject(next.project); setDraft(next.project);
    return next;
  }, []);
  const loadWorkspace = useCallback(async () => {
    try {
      const [{ projects: stored, runs }, catalog, profileData] = await Promise.all([
        api<{ projects: Project[]; runs: Array<{ id: string; projectId: string }> }>("/api/projects"),
        api<{ providers: ProviderCatalog[] }>("/api/providers"),
        api<{ profiles: RunProfile[] }>("/api/profiles"),
      ]);
      setProjects(stored); setProviders(catalog.providers);
      setRunProfiles(profileData.profiles);
      if (stored[0]) { setProject(stored[0]); setDraft(stored[0]); }
      const latest = stored[0] ? runs.find((run) => run.projectId === stored[0].id) : undefined;
      if (latest) await loadRun(latest.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load the workspace."); }
  }, [loadRun]);
  useEffect(() => { const timer=window.setTimeout(() => void loadWorkspace(),0); return () => window.clearTimeout(timer); }, [loadWorkspace]);
  useEffect(() => {
    const refresh = () => void loadWorkspace();
    window.addEventListener("lemma:refresh", refresh);
    return () => window.removeEventListener("lemma:refresh", refresh);
  }, [loadWorkspace]);

  const mainResults = useMemo(() => bundle?.results.filter((r) => !r.isDeepPass) ?? [], [bundle]);
  const claims = useMemo(() => (bundle?.results ?? []).flatMap((r) => r.output?.claims ?? []), [bundle]);
  const supported = claims.filter((claim) => claim.verificationStatus !== "unverified" && claim.verificationStatus !== "contested").length;
  const selectedClaim = claims[0];
  const used = bundle?.run.outputTokens ?? 0;
  const limit = bundle?.run.profileSnapshot.totalOutputLimit ?? 18_000;
  const currentProfile = runProfiles.find((p) => p.id === profileId) ?? initialProfiles[0];
  const providerReady = providers.length === 0 || providers.some((p) => p.configured);

  async function saveProject() {
    setBusy(true); setNotice(null);
    try {
      const result = project.id
        ? await api<{ project: Project }>(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
        : await api<{ project: Project }>("/api/projects", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key("project") }, body: JSON.stringify(draft) });
      setProject(result.project); setDraft(result.project); setProjects((old) => [result.project, ...old.filter((p) => p.id !== result.project.id)]); setNotice("Problem specification saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the problem."); }
    finally { setBusy(false); }
  }
  function newProject() { const blank = { ...sample, title: "Untitled combinatorics problem", statement: "State the mathematical problem to investigate." }; setProject({ ...blank, id: undefined }); setDraft(blank); setBundle(null); setTab("problem"); }
  async function selectProject(next: Project) {
    setProject(next); setDraft(next); setBundle(null); setNotice(null);
    const listing = await api<{ runs: Array<{ id: string; projectId: string }> }>("/api/projects");
    const latest = listing.runs.find((run) => run.projectId === next.id);
    if (latest) await loadRun(latest.id);
  }
  async function startRun() {
    if (!project.id) { setNotice("Save the problem specification before starting a run."); setTab("problem"); return; }
    setBusy(true); setNotice(null);
    try {
      const response = await api<{ run: { id: string } }>("/api/runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key("run") }, body: JSON.stringify({ projectId: project.id, profileId }) });
      await loadRun(response.run.id); setNotice("Run created. Advance one auditable stage at a time, or run all remaining stages.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not start the run."); }
    finally { setBusy(false); }
  }
  async function advance(override?: Record<string, unknown>) {
    if (!bundle) return null;
    const result = await api(`/api/runs/${bundle.run.id}/advance`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key("advance") }, body: JSON.stringify(override ?? {}) });
    return loadRun(bundle.run.id).then(() => result);
  }
  async function advanceOne() { setBusy(true); setNotice(null); try { await advance(); } catch (error) { setNotice(error instanceof Error ? error.message : "Stage failed."); await loadRun(bundle!.run.id).catch(() => undefined); } finally { setBusy(false); } }
  async function runRemaining() {
    if (!bundle) return; stopRef.current = false; setBusy(true); setNotice(null);
    try {
      let next = bundle;
      while (next.run.currentStage < stageIds.length && !stopRef.current) {
        await api(`/api/runs/${next.run.id}/advance`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key("advance") }, body: "{}" });
        next = await loadRun(next.run.id);
      }
      if (next.run.status === "completed") setNotice("Dossier complete. Every claim retains its provenance and verification label.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The run stopped at a stage boundary."); await loadRun(bundle.run.id).catch(() => undefined); }
    finally { setBusy(false); }
  }
  async function cancelRun() {
    if (!bundle) return; stopRef.current = true;
    try { await api(`/api/runs/${bundle.run.id}/cancel`, { method: "POST", headers: { "Idempotency-Key": key("cancel") } }); await loadRun(bundle.run.id); setNotice("Run cancelled. Completed stages were preserved."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not cancel the run."); }
  }
  async function deepen(model: string) {
    if (!bundle) return; setBusy(true); setNotice(null);
    try { await api(`/api/runs/${bundle.run.id}/deepen`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key("deepen") }, body: JSON.stringify({ stage: "critique", model, reasoning: "high", maxOutputTokens: 5000 }) }); await loadRun(bundle.run.id); setNotice(`Deep critique saved separately with ${model}.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Deep pass failed."); }
    finally { setBusy(false); }
  }
  function updateProfileStage(stage: (typeof stageIds)[number], patch: Partial<ModelRef>) {
    setProfileDraft((old) => ({ ...old, stages: { ...old.stages, [stage]: { ...old.stages[stage], ...patch } } }));
  }
  function selectProfile(id: string) {
    setProfileId(id);
    const selected = runProfiles.find((profile) => profile.id === id);
    if (selected) setProfileDraft(structuredClone(selected));
  }
  async function saveProfile() {
    setBusy(true); setNotice(null);
    const isSaved = Boolean(profileDraft.id && !initialProfiles.some((p) => p.id === profileDraft.id));
    try {
      const result = await api<{ profile: RunProfile }>(isSaved ? `/api/profiles/${profileDraft.id}` : "/api/profiles", { method: isSaved ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key("profile") }, body: JSON.stringify({ name: profileDraft.name, totalOutputLimit: profileDraft.totalOutputLimit, stages: profileDraft.stages }) });
      setRunProfiles((old) => [...old.filter((p) => p.id !== result.profile.id), result.profile]); setProfileDraft(result.profile); setProfileId(result.profile.id); setNotice("Private run profile saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the profile."); }
    finally { setBusy(false); }
  }
  async function reroute(model: string) {
    setBusy(true); setNotice(null);
    try { await advance({ model, reasoning: "low", maxOutputTokens: 3000 }); setNotice(`Stage rerouted explicitly to ${model}.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Rerouted stage failed."); if (bundle) await loadRun(bundle.run.id).catch(() => undefined); }
    finally { setBusy(false); }
  }

  const runState = bundle?.run.status ?? "not started";
  const currentStage = bundle?.run.currentStage ?? 0;
  const evidenceResult = mainResults.find((r) => r.stage === "evidence");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <WebMcpRegistration />
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">A</div>
        <div><p className="eyebrow">Lemma</p><p className="brand-subtitle">Research workspace</p></div>
        <div className="topbar-center"><span className="status-dot" /> Private workspace · {user.displayName}</div>
        <div className="topbar-actions">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setTab("sources")}><Search /> Search</Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => { setTab("report"); setTimeout(() => window.print(), 80); }}><Printer /> Export PDF</Button>
          <div className="avatar" title={user.email}>{initials(user.displayName)}</div>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="project-rail">
          <div className="rail-heading"><span>Research files</span><Button variant="ghost" size="icon-sm" aria-label="Create research file" onClick={newProject}><Plus /></Button></div>
          {(projects.length ? projects : [sample as Project]).map((item, index) => <button key={item.id ?? "sample"} className={`project-item ${(project.id === item.id || (!project.id && index === 0)) ? "active" : ""}`} onClick={() => item.id ? void selectProject(item) : undefined}><span className={`project-glyph ${index ? "muted" : ""}`}>{item.title[0]}</span><span><strong>{item.title}</strong><small>{item.id ? "Saved research file" : "Interactive benchmark"}</small></span></button>)}
          <div className="rail-rule" />
          <p className="rail-label">Saved profiles</p>
          <button className="plain-item" onClick={() => setProfileId("deepseek-economy")}><Gauge /> DeepSeek Economy</button>
          <button className="plain-item" onClick={() => setProfileId("openai-economy")}><BrainCircuit /> OpenAI Economy</button>
          <button className="plain-item" onClick={() => setProfileId("mixed-economy")}><GitBranch /> Mixed Economy</button>
          <div className="credit-card"><div><span>Run allowance</span><strong>{used.toLocaleString()} / {limit.toLocaleString()}</strong></div><Progress value={Math.min(100, (used / limit) * 100)} /><p>Limits stop work at stage boundaries. Deep passes always require an explicit action.</p></div>
        </aside>

        <section className="research-main">
          <div className="problem-heading"><div><p className="eyebrow">PRIVATE FILE · COMBINATORICS</p><h1>{project.title}</h1></div><Button variant="ghost" size="icon" aria-label="Project actions"><MoreHorizontal /></Button></div>
          <div className="formula-card"><div className="formula-index">RESEARCH STATEMENT</div><p className="formula-text">{project.statement}</p>{project.title.toLowerCase().includes("triangle") && <MathFormula expression={String.raw`e(G) \le \left\lfloor n^2/4 \right\rfloor`} />}<div className="formula-meta"><Badge variant="outline">Researcher supplied</Badge><span>Definitions {project.definitions.length}</span><span>Assumptions {project.assumptions.length}</span><span>Bounds n ≤ {project.bounds.maxVertices}</span></div></div>

          {notice && <div className="notice-banner" role="status"><AlertTriangle /> <span>{notice}</span></div>}
          <Tabs value={tab} onValueChange={setTab} className="research-tabs">
            <TabsList variant="line"><TabsTrigger value="run">Research run</TabsTrigger><TabsTrigger value="problem">Problem specification</TabsTrigger><TabsTrigger value="profiles">Run profiles</TabsTrigger><TabsTrigger value="sources">Sources <span className="tab-count">{project.userSources.length + (evidenceResult?.output?.artifacts.length ?? 0)}</span></TabsTrigger><TabsTrigger value="report">Dossier</TabsTrigger></TabsList>
            <TabsContent value="run" className="pt-6">
              <div className="run-header"><div><p className="section-kicker"><span className="status-dot" /> {runState.toUpperCase()}</p><h2>{bundle ? stageLabels[stageIds[Math.min(currentStage, 5)]] : "Ready for investigation"}</h2><p>Each stage is validated and persisted before the next provider call.</p></div><div className="profile-control"><label htmlFor="run-profile">Run profile</label><Select value={profileId} onValueChange={selectProfile} disabled={Boolean(bundle)}><SelectTrigger id="run-profile"><SelectValue /></SelectTrigger><SelectContent>{runProfiles.map((p) => <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="preflight"><div><strong>{currentProfile.name}</strong><span>{currentProfile.stages.normalize.model} → {currentProfile.stages.synthesis.model}</span></div><div><strong>{currentProfile.totalOutputLimit.toLocaleString()}</strong><span>maximum output tokens</span></div><div><strong>{providers.filter((p) => p.configured).length || "—"}</strong><span>configured providers</span></div></div>
              <div className="run-actions">
                {!bundle && <Button onClick={startRun} disabled={busy || !providerReady}><Play /> Start dossier run</Button>}
                {bundle && currentStage < stageIds.length && runState !== "cancelled" && <><Button onClick={advanceOne} disabled={busy}><ChevronRight /> Advance one stage</Button><Button variant="outline" onClick={runRemaining} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play />} Run remaining</Button><Button variant="ghost" onClick={cancelRun}><CircleStop /> Cancel</Button></>}
                {bundle?.run.status === "failed" && <>
                  <Button variant="outline" onClick={advanceOne} disabled={busy}><RotateCcw /> Retry same model</Button>
                  {(providers[0]?.models.filter((m) => !m.deep) ?? []).map((m) => <Button key={m.id} variant="ghost" onClick={() => void reroute(m.id)} disabled={busy}>Reroute to {m.label}</Button>)}
                </>}
                {bundle?.run.status === "cancelled" && <span className="boundary-note"><Pause /> Cancelled; completed results remain stored.</span>}
              </div>
              <div className="stage-list">{stageIds.map((stage, index) => {
                const result = [...mainResults].reverse().find((r) => r.stage === stage);
                const state = result?.status === "failed" ? "failed" : result?.status === "completed" ? "done" : busy && index === currentStage ? "active" : index === currentStage && bundle ? "ready" : "waiting";
                return <div className={`stage-row ${state}`} key={stage}><div className="stage-number">{state === "done" ? <CircleCheck /> : state === "active" ? <CircleDashed /> : state === "failed" ? <AlertTriangle /> : index + 1}</div><div className="stage-copy"><strong>{stageLabels[stage]}</strong><span>{result ? `${result.requestedModel} · ${(result.usage.outputTokens ?? 0).toLocaleString()} output tokens${result.attempt > 1 ? ` · attempt ${result.attempt}` : ""}` : stageNotes[stage]}</span></div>{state === "active" && <Progress value={54} className="stage-progress" />}{result?.output && <button className="inspect-link" onClick={() => setTab(stage === "synthesis" ? "report" : "sources")}>Inspect <ChevronRight /></button>}</div>;
              })}</div>
              <div className="evidence-grid">
                <article className="evidence-card"><div className="card-icon"><Library /></div><div className="card-heading"><span>Literature scout</span><Badge className="badge-source">SOURCE-SUPPORTED</Badge></div><h3>{evidenceResult?.output?.artifacts.find((a) => a.type === "source")?.title ?? "Crossref and arXiv metadata search"}</h3><p>{evidenceResult?.output?.summary ?? "The evidence stage searches cached public metadata before asking a model to interpret the results."}</p><div className="source-row"><BookOpen /><span><strong>Metadata-only research</strong><small>HTTPS sources · deduplicated · maximum 12</small></span><ChevronRight /></div></article>
                <article className="evidence-card"><div className="card-icon"><FlaskConical /></div><div className="card-heading"><span>Experiment engine</span><Badge className="badge-compute">COMPUTATION-SUPPORTED</Badge></div><h3>{evidenceResult ? "Bounded deterministic experiment recorded" : `Ready to enumerate through n = ${project.bounds.maxVertices}`}</h3><p>No generated code is executed. The reproducible graph kernel records its algorithm version, parameters, witness, and result.</p><div className="metric-strip"><span><strong>1</strong> batch maximum</span><span><strong>0</strong> arbitrary scripts</span><span><strong>v1</strong> kernel</span></div></article>
              </div>
            </TabsContent>

            <TabsContent value="profiles" className="editor-panel">
              <div className="panel-heading"><div><p className="section-kicker">CREDIT CONTROLS</p><h2>Private run profile</h2></div><Button onClick={saveProfile} disabled={busy}>Save profile</Button></div>
              <div className="form-grid"><label>Profile name<Input value={profileDraft.name} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} /></label><label>Total output limit<Input type="number" min={1000} max={18000} value={profileDraft.totalOutputLimit} onChange={(e) => setProfileDraft({ ...profileDraft, totalOutputLimit: Number(e.target.value) })} /></label></div>
              <div className="profile-matrix">{stageIds.map((stage) => <div className="profile-row" key={stage}><strong>{stageLabels[stage]}</strong><Select value={profileDraft.stages[stage].model} onValueChange={(model: string) => updateProfileStage(stage, { model })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(providers[0]?.models.filter((m) => !m.deep) ?? []).map((m) => <SelectItem value={m.id} key={m.id}>{m.label}</SelectItem>)}</SelectContent></Select><Select value={profileDraft.stages[stage].reasoning} onValueChange={(reasoning: ModelRef["reasoning"]) => updateProfileStage(stage, { reasoning })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select><Input type="number" min={256} max={5000} value={profileDraft.stages[stage].maxOutputTokens} onChange={(e) => updateProfileStage(stage, { maxOutputTokens: Number(e.target.value) })} aria-label={`${stage} output cap`} /></div>)}</div>
              <p className="matrix-note">Assignments are explicit. The orchestrator never falls back across models or starts a paid retry automatically.</p>
            </TabsContent>

            <TabsContent value="problem" className="editor-panel">
              <div className="panel-heading"><div><p className="section-kicker">STRUCTURED INPUT</p><h2>Problem specification</h2></div><Button onClick={saveProject} disabled={busy}>{project.id ? "Save changes" : "Create research file"}</Button></div>
              <label>Title<Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label>Statement<Textarea rows={6} value={draft.statement} onChange={(e) => setDraft({ ...draft, statement: e.target.value })} /></label>
              <div className="form-grid"><label>Definitions, one per line<Textarea rows={5} value={draft.definitions.join("\n")} onChange={(e) => setDraft({ ...draft, definitions: splitLines(e.target.value) })} /></label><label>Assumptions, one per line<Textarea rows={5} value={draft.assumptions.join("\n")} onChange={(e) => setDraft({ ...draft, assumptions: splitLines(e.target.value) })} /></label></div>
              <label>Known results, one per line<Textarea rows={4} value={draft.knownResults.join("\n")} onChange={(e) => setDraft({ ...draft, knownResults: splitLines(e.target.value) })} /></label>
              <div className="bounds-row"><label>Minimum vertices<Input type="number" min={1} max={12} value={draft.bounds.minVertices} onChange={(e) => setDraft({ ...draft, bounds: { ...draft.bounds, minVertices: Number(e.target.value) } })} /></label><label>Maximum vertices<Input type="number" min={1} max={12} value={draft.bounds.maxVertices} onChange={(e) => setDraft({ ...draft, bounds: { ...draft.bounds, maxVertices: Number(e.target.value) } })} /></label></div>
              <div className="source-editor"><p className="section-kicker">OPTIONAL USER SOURCE</p><div className="form-grid"><label>Source title<Input value={draft.userSources[0]?.title ?? ""} onChange={(e) => setDraft({ ...draft, userSources: [{ title: e.target.value, url: draft.userSources[0]?.url ?? "https://", abstract: draft.userSources[0]?.abstract }] })} /></label><label>HTTPS URL<Input type="url" value={draft.userSources[0]?.url ?? ""} placeholder="https://…" onChange={(e) => setDraft({ ...draft, userSources: [{ title: draft.userSources[0]?.title ?? "Researcher-supplied source", url: e.target.value, abstract: draft.userSources[0]?.abstract }] })} /></label></div><label>Abstract or citation note<Textarea rows={3} value={draft.userSources[0]?.abstract ?? ""} onChange={(e) => setDraft({ ...draft, userSources: [{ title: draft.userSources[0]?.title ?? "Researcher-supplied source", url: draft.userSources[0]?.url ?? "https://", abstract: e.target.value }] })} /></label>{draft.userSources.length > 0 && <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, userSources: [] })}>Remove source</Button>}</div>
            </TabsContent>

            <TabsContent value="sources" className="artifact-panel">
              <div className="panel-heading"><div><p className="section-kicker">PROVENANCE LEDGER</p><h2>Sources, experiments, and stage artifacts</h2></div></div>
              {!bundle && <div className="empty-state">Start a run to populate normalized literature and reproducible experiment records.</div>}
              {(bundle?.results ?? []).map((result) => <article className="artifact-row" key={result.id}><div><Badge variant="outline">{result.stage}{result.isDeepPass ? " · DEEP PASS" : ""}</Badge><span>{result.provider} / {result.returnedModel ?? result.requestedModel}</span></div><h3>{result.output?.summary ?? result.error?.message ?? "No validated output"}</h3>{result.output?.artifacts.map((artifact) => <details key={artifact.id}><summary>{artifact.title}</summary><p>{artifact.content}</p><pre>{JSON.stringify(artifact.metadata, null, 2)}</pre></details>)}</article>)}
            </TabsContent>

            <TabsContent value="report" className="dossier-panel">
              <div className="report-title"><p className="eyebrow">LEMMA RESEARCH DOSSIER</p><h2>{project.title}</h2><p>{project.statement}</p></div>
              {mainResults.length === 0 && <div className="empty-state">The dossier grows stage by stage. Start the run when the specification is ready.</div>}
              {mainResults.map((result, index) => <section className="report-section" key={result.id}><div className="report-section-number">{String(index + 1).padStart(2, "0")}</div><div><p className="section-kicker">{result.stage.toUpperCase()} · {result.requestedModel}</p><h3>{stageLabels[result.stage as keyof typeof stageLabels]}</h3><p>{result.output?.summary}</p>{result.output?.claims.map((claim) => <div className="report-claim" key={claim.id}><Badge className={`status-${claim.verificationStatus}`}>{claim.verificationStatus}</Badge><span>{claim.text}</span>{claim.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>)}</div></section>)}
              {mainResults.length > 0 && <section className="audit-appendix"><h3>Audit appendix</h3><p>Claims: {claims.length} · Evidence-linked or internally checked: {supported} · Output usage: {used.toLocaleString()} tokens.</p><p>No model agreement is treated as verification. No non-formal argument is labeled as a formal proof.</p></section>}
            </TabsContent>
          </Tabs>
        </section>

        <aside className="audit-panel">
          <div className="audit-heading"><div><p className="eyebrow">AUDIT LENS</p><h2>Claim provenance</h2></div><ShieldCheck /></div><div className="audit-score"><div className="score-ring">{claims.length ? Math.round((supported / claims.length) * 100) : 0}%</div><div><strong>Evidence coverage</strong><p>{supported} of {claims.length} claims are supported or internally checked.</p></div></div><div className="audit-rule" /><p className="rail-label">SELECTED CLAIM</p><blockquote>{selectedClaim?.text ?? "Select or generate a claim to inspect its evidence chain."}</blockquote><div className="claim-status"><Badge className="badge-internal">{selectedClaim?.verificationStatus?.toUpperCase() ?? "UNVERIFIED"}</Badge><span>Never a formal proof label</span></div>
          <div className="evidence-chain"><p className="rail-label">EVIDENCE CHAIN</p><div><span className="chain-icon"><Library /></span><span><strong>Literature metadata</strong><small>Crossref, arXiv, or researcher supplied</small></span></div><div><span className="chain-icon"><FlaskConical /></span><span><strong>Finite verification</strong><small>Bounded and reproducible</small></span></div><div><span className="chain-icon warning"><CircleDashed /></span><span><strong>Formal verification</strong><small>Outside this milestone</small></span></div></div>
          {(providers[0]?.models.filter((m) => m.deep) ?? []).map((m, index) => <Button key={m.id} variant={index === 0 ? "default" : "outline"} className={index === 0 ? "deep-button" : "deep-alt"} disabled={!bundle || busy} onClick={() => void deepen(m.id)}><Sparkles /> Deepen with {m.label}</Button>)}
          <p className="deep-note">Each deep pass is separate and limited to 5,000 output tokens.</p>
          <div className="provider-status"><p className="rail-label">PROVIDER STATUS</p>{providers.map((provider) => <div key={provider.id}><span className={provider.configured ? "status-dot" : "offline-dot"} />{provider.id}<small>{provider.configured ? "configured" : "secret required"}</small></div>)}</div>
        </aside>
      </div>
    </main>
  );
}
