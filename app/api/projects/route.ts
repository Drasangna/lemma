import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, researchRuns } from "@/db/schema";
import { errorResponse, requireApiUser, requireIdempotencyKey } from "@/lib/api-helpers";
import { problemSpecSchema } from "@/lib/research-types";
import { listOwnedProjects, replayIdempotent, saveIdempotent, serializeProject } from "@/lib/repository";

export async function GET(){try{const user=await requireApiUser();const items=await listOwnedProjects(user.userId);const latestRuns=await getDb().select().from(researchRuns).where(eq(researchRuns.ownerId,user.userId)).orderBy(desc(researchRuns.updatedAt));return Response.json({projects:items,runs:latestRuns})}catch(error){return errorResponse(error)}}
export async function POST(request:Request){try{const user=await requireApiUser(),key=requireIdempotencyKey(request);const replay=await replayIdempotent(user.userId,key,"create-project");if(replay)return Response.json(replay,{status:200});const spec=problemSpecSchema.parse(await request.json());const now=Date.now(),id=crypto.randomUUID();const [row]=await getDb().insert(projects).values({id,ownerId:user.userId,title:spec.title,field:spec.field,statement:spec.statement,definitionsJson:JSON.stringify(spec.definitions),assumptionsJson:JSON.stringify(spec.assumptions),knownResultsJson:JSON.stringify(spec.knownResults),boundsJson:spec.bounds?JSON.stringify(spec.bounds):"{}",mode:spec.mode,existingProof:spec.existingProof??null,userSourcesJson:JSON.stringify(spec.userSources),createdAt:now,updatedAt:now}).returning();const response={project:serializeProject(row)};await saveIdempotent(user.userId,key,"create-project",response);return Response.json(response,{status:201})}catch(error){return errorResponse(error)}}
