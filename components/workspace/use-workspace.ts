"use client";

/**
 * All workspace state and actions. Components stay presentational: they read from and call into
 * the object returned by `useWorkspace()`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, send } from "@/lib/client-api";
import type { providerStatus } from "@/lib/providers";
import type { getRunBundle, listOwnedRuns, Project } from "@/lib/repository";
import { BUILT_IN_PROFILES, DEFAULT_PROFILE_ID } from "@/lib/run-profiles";
import {
  COMBINATORICS_FIELD_PATTERN,
  stageIds,
  type ModelRef,
  type ProblemSpec,
  type RunProfile,
  type StageId,
} from "@/lib/research-types";

export type RunBundle = ReturnType<typeof getRunBundle>;
export type ResultRow = RunBundle["results"][number];
export type ProviderStatus = ReturnType<typeof providerStatus>;
/** A project that may not be saved yet (no id). */
export type ProjectDraft = ProblemSpec & { id?: string };
type RunSummary = ReturnType<typeof listOwnedRuns>[number];

export const SAMPLE_PROJECT: ProjectDraft = {
  title: "Triangle-free graphs at the extremal boundary",
  field: "combinatorics",
  statement: "If G is a triangle-free graph on n vertices, then $e(G) \\le \\lfloor n^2/4 \\rfloor$.",
  definitions: ["G is a finite simple graph.", "A graph is triangle-free when it has no 3-cycle."],
  assumptions: ["n is a positive integer."],
  knownResults: ["Balanced complete bipartite graphs attain the proposed bound."],
  bounds: { minVertices: 1, maxVertices: 6 },
  mode: "prove",
  userSources: [],
};

const builtInProfiles = Object.values(BUILT_IN_PROFILES);
const blankProfile = (): RunProfile => ({
  ...builtInProfiles[0],
  id: "",
  name: "My research profile",
  stages: structuredClone(builtInProfiles[0].stages),
});

export function useWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [project, setProject] = useState<ProjectDraft>(SAMPLE_PROJECT); // what the page shows
  const [draft, setDraft] = useState<ProjectDraft>(SAMPLE_PROJECT); // what the form edits
  const [profiles, setProfiles] = useState<RunProfile[]>(builtInProfiles);
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [profileDraft, setProfileDraft] = useState<RunProfile>(blankProfile);
  const [bundle, setBundle] = useState<RunBundle | null>(null);
  const [models, setModels] = useState<ProviderStatus>({
    provider: "openrouter",
    configured: false,
    models: [],
  });
  const [tab, setTab] = useState("run");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stopRequested = useRef(false);

  // ---- loading -------------------------------------------------------------------------

  const loadRun = useCallback(async (id: string) => {
    const next = await api<RunBundle>(`/api/runs/${id}`);
    setBundle(next);
    setProject(next.project);
    setDraft(next.project);
    return next;
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const [listing, status, profileList] = await Promise.all([
        api<{ projects: Project[]; runs: RunSummary[] }>("/api/projects"),
        api<ProviderStatus>("/api/providers"),
        api<{ profiles: RunProfile[] }>("/api/profiles"),
      ]);
      setProjects(listing.projects);
      setRuns(listing.runs);
      setModels(status);
      setProfiles(profileList.profiles);

      const [first] = listing.projects;
      if (!first) return;
      setProject(first);
      setDraft(first);
      const latest = listing.runs.find((run) => run.projectId === first.id);
      if (latest) await loadRun(latest.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the workspace.");
    }
  }, [loadRun]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  // WebMCP tools create records outside React, then ask the UI to reload.
  useEffect(() => {
    const refresh = () => void loadWorkspace();
    window.addEventListener("lemma:refresh", refresh);
    return () => window.removeEventListener("lemma:refresh", refresh);
  }, [loadWorkspace]);

  // ---- derived -------------------------------------------------------------------------

  const derived = useMemo(() => {
    const results = bundle?.results ?? [];
    const mainResults = results.filter((r) => !r.isDeepPass);
    const claims = results.flatMap((r) => r.output?.claims ?? []);
    const supported = claims.filter(
      (c) => c.verificationStatus !== "unverified" && c.verificationStatus !== "contested",
    ).length;
    return {
      mainResults,
      claims,
      supported,
      evidenceResult: mainResults.find((r) => r.stage === "evidence"),
      currentStage: bundle?.run.currentStage ?? 0,
      runState: bundle?.run.status ?? "not started",
      tokensUsed: bundle?.run.outputTokens ?? 0,
      tokenLimit: bundle?.run.profileSnapshot.totalOutputLimit ?? 18_000,
      currentProfile: profiles.find((p) => p.id === profileId) ?? builtInProfiles[0],
      economyModels: models.models.filter((m) => !m.deep),
      deepModels: models.models.filter((m) => m.deep),
    };
  }, [bundle, profiles, profileId, models]);

  // ---- actions -------------------------------------------------------------------------

  /** Runs an action with the busy flag and error notice handled in one place. */
  async function act(
    fallbackError: string,
    action: () => Promise<string | void>,
    options: { reloadRunOnError?: boolean } = {},
  ) {
    setBusy(true);
    setNotice(null);
    try {
      const message = await action();
      if (message) setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : fallbackError);
      // A failed stage is recorded on the server, so show its failed state.
      if (options.reloadRunOnError && bundle) await loadRun(bundle.run.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const advanceRequest = (runId: string, override: Partial<ModelRef> = {}) =>
    send("POST", `/api/runs/${runId}/advance`, override, "advance");

  return {
    // state
    projects,
    project,
    draft,
    setDraft,
    profiles,
    profileId,
    profileDraft,
    setProfileDraft,
    bundle,
    models,
    tab,
    setTab,
    busy,
    notice,
    ...derived,

    newProject() {
      const blank = {
        ...SAMPLE_PROJECT,
        title: "Untitled research problem",
        statement: "State the mathematical problem to investigate.",
      };
      setProject({ ...blank, id: undefined });
      setDraft(blank);
      setBundle(null);
      setTab("problem");
    },

    async selectProject(next: ProjectDraft) {
      setProject(next);
      setDraft(next);
      setBundle(null);
      setNotice(null);
      const latest = runs.find((run) => run.projectId === next.id);
      if (latest) await loadRun(latest.id).catch((error) => setNotice(error.message));
    },

    saveProject: () =>
      act("Could not save the problem.", async () => {
        // Vertex bounds only mean something for combinatorics/graph fields; never save stale ones.
        const payload = {
          ...draft,
          bounds: draft.bounds && COMBINATORICS_FIELD_PATTERN.test(draft.field) ? draft.bounds : undefined,
        };
        const { project: saved } = project.id
          ? await send<{ project: Project }>("PATCH", `/api/projects/${project.id}`, payload)
          : await send<{ project: Project }>("POST", "/api/projects", payload, "project");
        setProject(saved);
        setDraft(saved);
        setProjects((old) => [saved, ...old.filter((p) => p.id !== saved.id)]);
        return "Problem specification saved.";
      }),

    startRun: () =>
      act("Could not start the run.", async () => {
        if (!project.id) {
          setTab("problem");
          return "Save the problem specification before starting a run.";
        }
        const { run } = await send<{ run: { id: string; projectId: string; status: string } }>(
          "POST",
          "/api/runs",
          { projectId: project.id, profileId },
          "run",
        );
        setRuns((old) => [
          { id: run.id, projectId: run.projectId, status: run.status, updatedAt: Date.now() },
          ...old,
        ]);
        await loadRun(run.id);
        return "Run created. Advance one auditable stage at a time, or run all remaining stages.";
      }),

    advanceOne: () =>
      act(
        "Stage failed.",
        async () => {
          await advanceRequest(bundle!.run.id);
          await loadRun(bundle!.run.id);
        },
        { reloadRunOnError: true },
      ),

    /** Sends one persisted request per stage, so closing the tab never loses completed work. */
    runRemaining: () => {
      if (!bundle) return Promise.resolve();
      stopRequested.current = false;
      return act(
        "The run stopped at a stage boundary.",
        async () => {
          let current = bundle;
          while (current.run.currentStage < stageIds.length && !stopRequested.current) {
            await advanceRequest(current.run.id);
            current = await loadRun(current.run.id);
          }
          if (current.run.status === "completed")
            return "Dossier complete. Every claim retains its provenance and verification label.";
        },
        { reloadRunOnError: true },
      );
    },

    /** Reroutes the failed stage to a model the researcher chose explicitly. */
    reroute: (model: string) =>
      act(
        "Rerouted stage failed.",
        async () => {
          await advanceRequest(bundle!.run.id, { model, reasoning: "low", maxOutputTokens: 3000 });
          await loadRun(bundle!.run.id);
          return `Stage rerouted explicitly to ${model}.`;
        },
        { reloadRunOnError: true },
      ),

    async cancelRun() {
      if (!bundle) return;
      stopRequested.current = true;
      try {
        await send("POST", `/api/runs/${bundle.run.id}/cancel`, undefined, "cancel");
        await loadRun(bundle.run.id);
        setNotice("Run cancelled. Completed stages were preserved.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not cancel the run.");
      }
    },

    deepen: (model: string) =>
      act("Deep pass failed.", async () => {
        await send(
          "POST",
          `/api/runs/${bundle!.run.id}/deepen`,
          { stage: "critique", model, reasoning: "high", maxOutputTokens: 5000 },
          "deepen",
        );
        await loadRun(bundle!.run.id);
        return `Deep critique saved separately with ${model}.`;
      }),

    selectProfile(id: string) {
      setProfileId(id);
      const selected = profiles.find((p) => p.id === id);
      if (selected) setProfileDraft(structuredClone(selected));
    },

    updateProfileStage(stage: StageId, patch: Partial<ModelRef>) {
      setProfileDraft((old) => ({
        ...old,
        stages: { ...old.stages, [stage]: { ...old.stages[stage], ...patch } },
      }));
    },

    saveProfile: () =>
      act("Could not save the profile.", async () => {
        const isSaved = Boolean(profileDraft.id && !BUILT_IN_PROFILES[profileDraft.id]);
        const body = {
          name: profileDraft.name,
          totalOutputLimit: profileDraft.totalOutputLimit,
          stages: profileDraft.stages,
        };
        const { profile } = await send<{ profile: RunProfile }>(
          isSaved ? "PATCH" : "POST",
          isSaved ? `/api/profiles/${profileDraft.id}` : "/api/profiles",
          body,
          "profile",
        );
        setProfiles((old) => [...old.filter((p) => p.id !== profile.id), profile]);
        setProfileDraft(profile);
        setProfileId(profile.id);
        return "Private run profile saved.";
      }),
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
