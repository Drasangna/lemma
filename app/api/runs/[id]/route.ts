import { errorResponse, requireApiUser } from "@/lib/api-helpers";
import { getRunBundle } from "@/lib/repository";
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,{params}:Context){try{const user=await requireApiUser();return Response.json(await getRunBundle(user.userId,(await params).id))}catch(error){return errorResponse(error)}}
