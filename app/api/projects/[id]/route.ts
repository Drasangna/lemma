import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { ApiError, errorResponse, requireApiUser } from "@/lib/api-helpers";
import { problemSpecSchema } from "@/lib/research-types";
import { getOwnedProject, serializeProject } from "@/lib/repository";

type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){try{const user=await requireApiUser();const {id}=await params;return Response.json({project:serializeProject(await getOwnedProject(user.userId,id))})}catch(error){return errorResponse(error)}}
export async function PATCH(request:Request,{params}:Context){try{const user=await requireApiUser();const {id}=await params;await getOwnedProject(user.userId,id);const spec=problemSpecSchema.parse(await request.json());const [row]=await getDb().update(projects).set({title:spec.title,statement:spec.statement,definitionsJson:JSON.stringify(spec.definitions),assumptionsJson:JSON.stringify(spec.assumptions),knownResultsJson:JSON.stringify(spec.knownResults),boundsJson:JSON.stringify(spec.bounds),userSourcesJson:JSON.stringify(spec.userSources),updatedAt:Date.now()}).where(and(eq(projects.id,id),eq(projects.ownerId,user.userId))).returning();return Response.json({project:serializeProject(row)})}catch(error){return errorResponse(error)}}
export async function DELETE(_:Request,{params}:Context){try{const user=await requireApiUser();const {id}=await params;const row=await getOwnedProject(user.userId,id);await getDb().delete(projects).where(and(eq(projects.id,row.id),eq(projects.ownerId,user.userId)));return new Response(null,{status:204})}catch(error){if(error instanceof ApiError&&error.status===404)return new Response(null,{status:204});return errorResponse(error)}}
