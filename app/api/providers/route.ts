import { errorResponse, requireApiUser } from "@/lib/api-helpers";
import { providerCatalog } from "@/lib/providers";
import { BUILT_IN_PROFILES } from "@/lib/run-profiles";
export async function GET(){try{await requireApiUser();return Response.json({providers:providerCatalog(),builtInProfiles:Object.values(BUILT_IN_PROFILES)})}catch(error){return errorResponse(error)}}
