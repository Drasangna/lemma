import { getDb } from "@/db";
import { researchRuns, runProfiles } from "@/db/schema";
import { ApiError, errorResponse, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { getBuiltInProfile } from "@/lib/run-profiles";
import { getOwnedProject, replayIdempotent, saveIdempotent } from "@/lib/repository";
import { parseJson } from "@/lib/api-helpers";
import type { RunProfile } from "@/lib/research-types";
import { and, eq } from "drizzle-orm";

export async function POST(request:Request){try{const user=await requireApiUser(),key=requireIdempotencyKey(request);const replay=await replayIdempotent(user.userId,key,"start-run");if(replay)return Response.json(replay);const body=await request.json() as {projectId?:string;profileId?:string};if(!body.projectId)throw new ApiError(400,"projectId is required");await getOwnedProject(user.userId,body.projectId);let profile=getBuiltInProfile(body.profileId??"deepseek-economy");if(!profile&&body.profileId){const [saved]=await getDb().select().from(runProfiles).where(and(eq(runProfiles.id,body.profileId),eq(runProfiles.ownerId,user.userId))).limit(1);if(saved)profile=parseJson<RunProfile|null>(saved.configJson,null)}if(!profile)throw new ApiError(400,"Unknown run profile");const now=Date.now(),id=crypto.randomUUID();await getDb().insert(researchRuns).values({id,ownerId:user.userId,projectId:body.projectId,profileSnapshotJson:JSON.stringify(profile),status:"queued",currentStage:0,cancelRequested:false,createdAt:now,updatedAt:now});const response={run:{id,projectId:body.projectId,status:"queued",currentStage:0,profileSnapshot:profile}};await saveIdempotent(user.userId,key,"start-run",response);return Response.json(response,{status:201})}catch(error){return errorResponse(error)}}
