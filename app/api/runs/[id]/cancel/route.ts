import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { researchRuns } from "@/db/schema";
import { errorResponse, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { getOwnedRun } from "@/lib/repository";
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,{params}:Context){try{const user=await requireApiUser();requireIdempotencyKey(request);const {id}=await params;await getOwnedRun(user.userId,id);await getDb().update(researchRuns).set({cancelRequested:true,status:"cancelled",updatedAt:Date.now()}).where(and(eq(researchRuns.id,id),eq(researchRuns.ownerId,user.userId)));return Response.json({runId:id,status:"cancelled"})}catch(error){return errorResponse(error)}}
