import { env } from "cloudflare:workers";
import type { ProviderId } from "../research-types";
import { DeepSeekAdapter } from "./deepseek";
import { OpenAIAdapter } from "./openai";
import type { ModelProviderAdapter } from "./types";

export function getProvider(id:ProviderId):ModelProviderAdapter {
  return id==="openai"?new OpenAIAdapter(env.OPENAI_API_KEY):new DeepSeekAdapter(env.DEEPSEEK_API_KEY);
}
export function providerCatalog(){return (["openai","deepseek"] as const).map((id)=>{const adapter=getProvider(id);return {id,configured:adapter.configuredModels().length>0,capabilities:adapter.capabilities,models:adapter.configuredModels()}})}
export * from "./types";
