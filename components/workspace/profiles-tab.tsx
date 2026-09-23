"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reasoningSchema, stageIds } from "@/lib/research-types";
import { STAGE_LABELS } from "./stages";
import type { Workspace } from "./use-workspace";

export function ProfilesTab({ ws }: { ws: Workspace }) {
  const { profileDraft, setProfileDraft, updateProfileStage } = ws;
  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">CREDIT CONTROLS</p>
          <h2>Private run profile</h2>
        </div>
        <Button onClick={ws.saveProfile} disabled={ws.busy}>
          Save profile
        </Button>
      </div>

      <div className="form-grid">
        <label>
          Profile name
          <Input
            value={profileDraft.name}
            onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
          />
        </label>
        <label>
          Total output limit
          <Input
            type="number"
            min={1000}
            max={18000}
            value={profileDraft.totalOutputLimit}
            onChange={(e) => setProfileDraft({ ...profileDraft, totalOutputLimit: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="profile-matrix">
        {stageIds.map((stage) => {
          const assignment = profileDraft.stages[stage];
          return (
            <div className="profile-row" key={stage}>
              <strong>{STAGE_LABELS[stage]}</strong>
              <Select
                value={assignment.model}
                onValueChange={(model) => updateProfileStage(stage, { model })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ws.economyModels.map((m) => (
                    <SelectItem value={m.id} key={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={assignment.reasoning}
                onValueChange={(value) =>
                  updateProfileStage(stage, { reasoning: reasoningSchema.parse(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reasoningSchema.options.map((level) => (
                    <SelectItem value={level} key={level}>
                      {level[0].toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={256}
                max={5000}
                value={assignment.maxOutputTokens}
                aria-label={`${stage} output cap`}
                onChange={(e) => updateProfileStage(stage, { maxOutputTokens: Number(e.target.value) })}
              />
            </div>
          );
        })}
      </div>
      <p className="matrix-note">
        Assignments are explicit. The orchestrator never falls back across models or starts a paid retry
        automatically.
      </p>
    </>
  );
}
