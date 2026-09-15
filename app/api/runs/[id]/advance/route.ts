import { z } from "zod";
import { errorResponse, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { advanceRun } from "@/lib/orchestrator";
import { providerIdSchema, reasoningSchema } from "@/lib/research-types";
import { replayIdempotent, saveIdempotent } from "@/lib/repository";
type Context={params:Promise<{id:string}>};
const overrideSchema=z.object({provider:providerIdSchema,model:z.string().min(1).max(120),reasoning:reasoningSchema,maxOutputTokens:z.number().int().min(256).max(5000)}).partial();
export async function POST(request:Request,{params}:Context){try{const user=await requireApiUser(),key=requireIdempotencyKey(request),id=(await params).id;const operation=`advance:${id}`;const replay=await replayIdempotent(user.userId,key,operation);if(replay)return Response.json(replay);const body=overrideSchema.parse(await request.json().catch(()=>({})));const response=await advanceRun(user.userId,id,body);await saveIdempotent(user.userId,key,operation,response);return Response.json(response)}catch(error){return errorResponse(error)}}
