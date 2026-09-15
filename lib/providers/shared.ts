import { stageOutputSchema, type StageOutput, type Usage } from "../research-types";
import { ProviderError, type ProviderErrorCode } from "./types";
import type { ProviderId } from "../research-types";

type JsonRecord=Record<string,unknown>;
const record=(value:unknown):JsonRecord=>value!==null&&typeof value==="object"?value as JsonRecord:{};
export function extractOutputText(response:unknown):string {
  const root=record(response);if(typeof root.output_text==="string") return root.output_text;
  for(const itemValue of Array.isArray(root.output)?root.output:[]){const item=record(itemValue);if(item.type==="message")for(const partValue of Array.isArray(item.content)?item.content:[]){const part=record(partValue);if(typeof part.text==="string")return part.text}}
  return "";
}
export function parseStageOutput(provider:ProviderId,text:string):StageOutput {
  try{return stageOutputSchema.parse(JSON.parse(text))}catch(error){throw new ProviderError(provider,"invalid_output",`Provider returned an invalid research result: ${error instanceof Error?error.message:"invalid JSON"}`,true,422)}
}
export function normalizeUsage(raw:unknown):Usage {
  const value=record(raw),outputDetails=record(value.output_tokens_details),completionDetails=record(value.completion_tokens_details),inputDetails=record(value.input_tokens_details),promptDetails=record(value.prompt_tokens_details);
  const inputTokens=Number(value.input_tokens??value.prompt_tokens??0), outputTokens=Number(value.output_tokens??value.completion_tokens??0);
  const reasoningTokens=Number(outputDetails.reasoning_tokens??completionDetails.reasoning_tokens??0);
  const cachedTokens=Number(inputDetails.cached_tokens??value.prompt_cache_hit_tokens??promptDetails.cached_tokens??0);
  return {inputTokens,outputTokens,reasoningTokens,cachedTokens,totalTokens:Number(value.total_tokens??inputTokens+outputTokens)};
}
export function normalizeHttpError(provider:ProviderId,status:number,message:string):ProviderError {
  let code:ProviderErrorCode="upstream",retryable=status>=500||status===408;
  if(status===401||status===403){code="authentication";retryable=false}else if(status===429){code=message.toLowerCase().includes("quota")?"quota":"rate_limit";retryable=code==="rate_limit"}else if(status===408){code="timeout"}
  return new ProviderError(provider,code,message||`${provider} request failed`,retryable,status);
}
export async function fetchWithTimeout(url:string,init:RequestInit,provider:ProviderId,outerSignal?:AbortSignal):Promise<Response>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),55_000);
  const onAbort=()=>controller.abort();outerSignal?.addEventListener("abort",onAbort,{once:true});
  try{return await fetch(url,{...init,signal:controller.signal})}catch(error){if(controller.signal.aborted)throw new ProviderError(provider,"timeout",`${provider} request timed out`,true,408);throw new ProviderError(provider,"upstream",error instanceof Error?error.message:"Provider network error",true)}finally{clearTimeout(timer);outerSignal?.removeEventListener("abort",onAbort)}
}
