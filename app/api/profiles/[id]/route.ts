import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { runProfiles } from "@/db/schema";
import { ApiError, errorResponse, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { runProfileInputSchema } from "@/lib/research-types";

type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context){try{const user=await requireApiUser();requireIdempotencyKey(request);const {id}=await params;const profile=runProfileInputSchema.parse(await request.json());const stored={...profile,id};const [row]=await getDb().update(runProfiles).set({name:profile.name,configJson:JSON.stringify(stored),updatedAt:Date.now()}).where(and(eq(runProfiles.id,id),eq(runProfiles.ownerId,user.userId),eq(runProfiles.builtIn,false))).returning();if(!row)throw new ApiError(404,"Saved profile not found.");return Response.json({profile:stored})}catch(error){return errorResponse(error)}}
export async function DELETE(_:Request,{params}:Context){try{const user=await requireApiUser();const {id}=await params;await getDb().delete(runProfiles).where(and(eq(runProfiles.id,id),eq(runProfiles.ownerId,user.userId),eq(runProfiles.builtIn,false)));return new Response(null,{status:204})}catch(error){return errorResponse(error)}}
