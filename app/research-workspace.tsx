"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditPanel, ProjectRail, Topbar } from "@/components/workspace/chrome";
import { DossierTab, SourcesTab } from "@/components/workspace/evidence-tabs";
import { MathText } from "@/components/workspace/math-text";
import { ProblemTab } from "@/components/workspace/problem-tab";
import { ProfilesTab } from "@/components/workspace/profiles-tab";
import { RunTab } from "@/components/workspace/run-tab";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { WebMcpRegistration } from "@/components/workspace/webmcp";

export function ResearchWorkspace({ user }: { user: { displayName: string; email: string } }) {
  const ws = useWorkspace();
  const { project } = ws;
  const sourceCount = project.userSources.length + (ws.evidenceResult?.output?.artifacts.length ?? 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <WebMcpRegistration />
      <Topbar ws={ws} user={user} />

      <div className="workspace-grid">
        <ProjectRail ws={ws} />

        <section className="research-main">
          <div className="problem-heading">
            <div>
              <p className="eyebrow">PRIVATE FILE · {project.field.toUpperCase()}</p>
              <h1>{project.title}</h1>
            </div>
          </div>

          <div className="formula-card">
            <div className="formula-index">RESEARCH STATEMENT</div>
            <p className="formula-text">
              <MathText text={project.statement} />
            </p>
            <div className="formula-meta">
              <Badge variant="outline">
                {project.mode === "expand" ? "Existing proof supplied" : "Researcher supplied"}
              </Badge>
              <span>Definitions {project.definitions.length}</span>
              <span>Assumptions {project.assumptions.length}</span>
              {project.bounds && <span>Bounds n ≤ {project.bounds.maxVertices}</span>}
            </div>
          </div>

          {ws.notice && (
            <div className="notice-banner" role="status">
              <AlertTriangle /> <span>{ws.notice}</span>
            </div>
          )}

          <Tabs value={ws.tab} onValueChange={ws.setTab} className="research-tabs">
            <TabsList variant="line">
              <TabsTrigger value="run">Research run</TabsTrigger>
              <TabsTrigger value="problem">Problem specification</TabsTrigger>
              <TabsTrigger value="profiles">Run profiles</TabsTrigger>
              <TabsTrigger value="sources">
                Sources <span className="tab-count">{sourceCount}</span>
              </TabsTrigger>
              <TabsTrigger value="report">Dossier</TabsTrigger>
            </TabsList>
            <TabsContent value="run" className="pt-6">
              <RunTab ws={ws} />
            </TabsContent>
            <TabsContent value="problem" className="editor-panel">
              <ProblemTab ws={ws} />
            </TabsContent>
            <TabsContent value="profiles" className="editor-panel">
              <ProfilesTab ws={ws} />
            </TabsContent>
            <TabsContent value="sources" className="artifact-panel">
              <SourcesTab ws={ws} />
            </TabsContent>
            <TabsContent value="report" className="dossier-panel">
              <DossierTab ws={ws} />
            </TabsContent>
          </Tabs>
        </section>

        <AuditPanel ws={ws} />
      </div>
    </main>
  );
}
