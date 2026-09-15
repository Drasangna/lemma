import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { runProfiles } from "@/db/schema";
import { errorResponse, parseJson, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { BUILT_IN_PROFILES } from "@/lib/run-profiles";
import { runProfileInputSchema } from "@/lib/research-types";

export async function GET(){try{const user=await requireApiUser();const saved=await getDb().select().from(runProfiles).where(eq(runProfiles.ownerId,user.userId)).orderBy(desc(runProfiles.updatedAt));return Response.json({profiles:[...Object.values(BUILT_IN_PROFILES),...saved.map((p)=>parseJson(p.configJson,{}))]})}catch(error){return errorResponse(error)}}
export async function POST(request:Request){try{const user=await requireApiUser();requireIdempotencyKey(request);const profile=runProfileInputSchema.parse(await request.json());const now=Date.now(),id=crypto.randomUUID();const stored={...profile,id};await getDb().insert(runProfiles).values({id,ownerId:user.userId,name:profile.name,configJson:JSON.stringify(stored),builtIn:false,createdAt:now,updatedAt:now});return Response.json({profile:stored},{status:201})}catch(error){return errorResponse(error)}}
