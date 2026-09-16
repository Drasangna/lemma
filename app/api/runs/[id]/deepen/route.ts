import { z } from "zod";
import { errorResponse, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { deepenStage } from "@/lib/orchestrator";
import { reasoningSchema, stageIdSchema } from "@/lib/research-types";
import { replayIdempotent, saveIdempotent } from "@/lib/repository";
type Context={params:Promise<{id:string}>};
const schema=z.object({stage:stageIdSchema,model:z.string().min(1).max(120),reasoning:reasoningSchema.default("high"),maxOutputTokens:z.number().int().min(256).max(5000).default(5000)});
export async function POST(request:Request,{params}:Context){try{const user=await requireApiUser(),key=requireIdempotencyKey(request),id=(await params).id;const operation=`deepen:${id}`;const replay=await replayIdempotent(user.userId,key,operation);if(replay)return Response.json(replay);const body=schema.parse(await request.json());const response=await deepenStage(user.userId,id,body.stage,{model:body.model,reasoning:body.reasoning,maxOutputTokens:body.maxOutputTokens});await saveIdempotent(user.userId,key,operation,response);return Response.json(response)}catch(error){return errorResponse(error)}}
