import { getChatGPTUser } from "@/app/chatgpt-auth";

export class ApiError extends Error { constructor(public status:number,message:string,public details?:unknown){super(message)} }
export async function requireApiUser(){return getChatGPTUser()}
export function errorResponse(error:unknown){if(error instanceof ApiError)return Response.json({error:error.message,details:error.details},{status:error.status});const message=error instanceof Error?error.message:"Unexpected error";console.error(error);return Response.json({error:message},{status:500})}
export function requireIdempotencyKey(request:Request){const key=request.headers.get("idempotency-key")?.trim();if(!key||key.length>160)throw new ApiError(400,"A valid Idempotency-Key header is required.");return key}
export function parseJson<T>(value:string,fallback:T):T{try{return JSON.parse(value) as T}catch{return fallback}}
