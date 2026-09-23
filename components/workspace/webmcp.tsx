"use client";

/**
 * Exposes Lemma to AI agents through WebMCP (`document.modelContext`), when the browser has it.
 * The tools call the same API as the UI and never advance a paid stage on their own.
 */
import { useEffect } from "react";
import { api, send } from "@/lib/client-api";
import { BUILT_IN_PROFILES, DEFAULT_PROFILE_ID } from "@/lib/run-profiles";

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: Record<string, unknown>): Promise<unknown>;
};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): void | Promise<void>;
    };
  }
}

const stringList = { type: "array", items: { type: "string" } };

const TOOLS: WebMcpTool[] = [
  {
    name: "create_research_project",
    title: "Create research project",
    description:
      "Create a private research file from a structured problem specification (any field of mathematics).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "statement"],
      properties: {
        title: { type: "string", minLength: 3 },
        statement: { type: "string", minLength: 10 },
        field: { type: "string", description: "e.g. combinatorics, number theory, analysis" },
        mode: { enum: ["prove", "expand"], description: "expand = start from existingProof" },
        existingProof: { type: "string" },
        definitions: stringList,
        assumptions: stringList,
        knownResults: stringList,
        maxVertices: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          description: "Combinatorics/graph problems only",
        },
      },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute({ maxVertices, ...spec }) {
      const body = {
        ...spec,
        bounds: typeof maxVertices === "number" ? { minVertices: 1, maxVertices } : undefined,
      };
      const { project } = await send<{ project: { id: string; title: string } }>(
        "POST",
        "/api/projects",
        body,
        "webmcp-project",
      );
      return { projectId: project.id, title: project.title };
    },
  },
  {
    name: "start_dossier_run",
    title: "Start dossier run",
    description:
      "Create a persisted run with an explicit profile. No model tokens are spent until a stage is advanced.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["projectId"],
      properties: { projectId: { type: "string" }, profileId: { enum: Object.keys(BUILT_IN_PROFILES) } },
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute({ projectId, profileId }) {
      const { run } = await send<{ run: { id: string; status: string } }>(
        "POST",
        "/api/runs",
        { projectId, profileId: profileId ?? DEFAULT_PROFILE_ID },
        "webmcp-run",
      );
      return { runId: run.id, status: run.status };
    },
  },
  {
    name: "get_research_run",
    title: "Get research run",
    description: "Read the state, usage totals, and persisted stage results of a research run.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["runId"],
      properties: { runId: { type: "string" } },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute({ runId }) {
      const { run, results } = await api<{
        run: { id: string; status: string; currentStage: number; inputTokens: number; outputTokens: number };
        results: Array<{ stage: string; status: string }>;
      }>(`/api/runs/${encodeURIComponent(String(runId))}`);
      return {
        runId: run.id,
        status: run.status,
        currentStage: run.currentStage,
        usage: { inputTokens: run.inputTokens, outputTokens: run.outputTokens },
        stages: results.map(({ stage, status }) => ({ stage, status })),
      };
    },
  },
];

export function WebMcpRegistration() {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    for (const tool of TOOLS) {
      const execute = tool.execute;
      const wrapped = {
        ...tool,
        // After a mutation, tell the visible workspace to reload.
        execute: async (input: Record<string, unknown>) => {
          const result = await execute(input);
          if (!tool.annotations.readOnlyHint) window.dispatchEvent(new Event("lemma:refresh"));
          return result;
        },
      };
      void Promise.resolve(context.registerTool(wrapped, { signal: lifecycle.signal })).catch((error) =>
        console.warn("WebMCP registration failed", error),
      );
    }
    return () => lifecycle.abort();
  }, []);

  return null;
}
