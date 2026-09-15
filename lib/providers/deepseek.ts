import { stageOutputJsonSchema } from "../research-types";
import { extractOutputText, fetchWithTimeout, normalizeHttpError, normalizeUsage, parseStageOutput } from "./shared";
import { ProviderError, type GenerateStructuredRequest, type ModelProviderAdapter, type ProviderResponse, type ToolResult } from "./types";

export class DeepSeekAdapter implements ModelProviderAdapter {
  readonly providerId="deepseek" as const;
  readonly capabilities={structuredOutput:true,functionTools:true,reasoningControls:true,streaming:true,usageReporting:true};
  constructor(private apiKey?:string){}
  configuredModels(){return this.apiKey?[{id:"deepseek-flash",label:"DeepSeek Flash",deep:false},{id:"deepseek-v4-pro",label:"DeepSeek V4 Pro",deep:true}]:[]}
  async generateStructured(request:GenerateStructuredRequest):Promise<ProviderResponse>{
    if(!this.apiKey)throw new ProviderError("deepseek","not_configured","DeepSeek is not configured for this deployment.",false,503);
    const effort=request.reasoning==="medium"?"high":request.reasoning;
    const response=await fetchWithTimeout("https://api.deepseek.com/responses",{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:request.model,instructions:request.instructions,input:request.input,reasoning:{effort},max_output_tokens:request.maxOutputTokens,store:false,text:{format:{type:"json_schema",name:request.schemaName??"research_stage",schema:stageOutputJsonSchema}}})},"deepseek",request.signal);
    const payload=await response.json().catch(()=>({})) as Record<string,unknown>,error=payload.error as {message?:string}|undefined;if(!response.ok)throw normalizeHttpError("deepseek",response.status,error?.message??"DeepSeek request failed");
    return {output:parseStageOutput("deepseek",extractOutputText(payload)),providerResponseId:typeof payload.id==="string"?payload.id:crypto.randomUUID(),returnedModel:typeof payload.model==="string"?payload.model:request.model,finishState:payload.status==="completed"?"completed":"incomplete",usage:normalizeUsage(payload.usage),rawToolCalls:[]};
  }
  continueWithToolResults(request:GenerateStructuredRequest,previous:ProviderResponse,results:ToolResult[]){return this.generateStructured({...request,input:`${request.input}\n\nTool results:\n${JSON.stringify(results)}\n\nPrevious partial result:\n${JSON.stringify(previous.output)}`})}
}
