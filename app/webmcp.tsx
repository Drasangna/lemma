"use client";

import { useEffect } from "react";

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(input: unknown): unknown | Promise<unknown>;
};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): void | Promise<void>;
    };
  }
}

function idempotency(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status})`);
  return body;
}
function refreshVisibleWorkspace() { window.dispatchEvent(new Event("lemma:refresh")); }

export function WebMcpRegistration() {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebMcpTool) => {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch((error) => console.warn("WebMCP registration failed", error));
    };

    register({
      name: "create_research_project", title: "Create research project",
      description: "Create a private combinatorics research file from a structured problem specification.",
      inputSchema: { type: "object", additionalProperties: false, required: ["title", "statement"], properties: { title: { type: "string", minLength: 3 }, statement: { type: "string", minLength: 10 }, definitions: { type: "array", items: { type: "string" } }, assumptions: { type: "array", items: { type: "string" } }, knownResults: { type: "array", items: { type: "string" } }, maxVertices: { type: "integer", minimum: 1, maximum: 12 } } },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as Record<string, unknown>;
        if (typeof value.title !== "string" || typeof value.statement !== "string") throw new Error("title and statement are required strings");
        const body = { title: value.title, field: "combinatorics", statement: value.statement, definitions: Array.isArray(value.definitions) ? value.definitions : [], assumptions: Array.isArray(value.assumptions) ? value.assumptions : [], knownResults: Array.isArray(value.knownResults) ? value.knownResults : [], bounds: { minVertices: 1, maxVertices: typeof value.maxVertices === "number" ? value.maxVertices : 6 }, userSources: [] };
        const result = await jsonRequest("/api/projects", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotency("webmcp-project") }, body: JSON.stringify(body) }) as { project: { id: string; title: string } };
        refreshVisibleWorkspace();
        return { projectId: result.project.id, title: result.project.title };
      },
    });
    register({
      name: "start_dossier_run", title: "Start dossier run",
      description: "Start a persisted research run with an explicit saved profile. This creates the run but does not spend model tokens until a stage is advanced.",
      inputSchema: { type: "object", additionalProperties: false, required: ["projectId"], properties: { projectId: { type: "string" }, profileId: { type: "string", enum: ["deepseek-economy", "openai-economy", "mixed-economy"] } } },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { projectId?: unknown; profileId?: unknown };
        if (typeof value.projectId !== "string") throw new Error("projectId is required");
        const result = await jsonRequest("/api/runs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotency("webmcp-run") }, body: JSON.stringify({ projectId: value.projectId, profileId: typeof value.profileId === "string" ? value.profileId : "deepseek-economy" }) }) as { run: { id: string; status: string } };
        refreshVisibleWorkspace();
        return { runId: result.run.id, status: result.run.status };
      },
    });
    register({
      name: "get_research_run", title: "Get research run",
      description: "Read the current state, usage totals, and persisted stage results for an owned research run.",
      inputSchema: { type: "object", additionalProperties: false, required: ["runId"], properties: { runId: { type: "string" } } },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        const value = input as { runId?: unknown };
        if (typeof value.runId !== "string") throw new Error("runId is required");
        const result = await jsonRequest(`/api/runs/${encodeURIComponent(value.runId)}`) as { run: { id: string; status: string; currentStage: number; inputTokens: number; outputTokens: number }; results: Array<{ stage: string; status: string }> };
        return { runId: result.run.id, status: result.run.status, currentStage: result.run.currentStage, usage: { inputTokens: result.run.inputTokens, outputTokens: result.run.outputTokens }, stages: result.results.map((stage) => ({ stage: stage.stage, status: stage.status })) };
      },
    });
    return () => lifecycle.abort();
  }, []);
  return null;
}
