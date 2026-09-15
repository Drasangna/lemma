import assert from "node:assert/strict";
import test from "node:test";
import { DeepSeekAdapter } from "../lib/providers/deepseek";
import { OpenAIAdapter } from "../lib/providers/openai";
import { normalizeHttpError, normalizeUsage, parseStageOutput } from "../lib/providers/shared";
import type { GenerateStructuredRequest, ModelProviderAdapter, ProviderResponse, ToolResult } from "../lib/providers/types";

const output={summary:"A bounded result.",claims:[{id:"c1",text:"Finite evidence only.",kind:"observation" as const,verificationStatus:"computation-supported" as const,evidenceRefs:["experiment-1"],warnings:[]}],artifacts:[],openQuestions:[],suggestedNextSteps:[]};
class MockAdapter implements ModelProviderAdapter {
  readonly capabilities={structuredOutput:true,functionTools:true,reasoningControls:true,streaming:true,usageReporting:true};
  constructor(readonly providerId:"openai"|"deepseek"){}
  configuredModels(){return[{id:`${this.providerId}-mock`,label:"Mock",deep:false}]}
  async generateStructured(request:GenerateStructuredRequest):Promise<ProviderResponse>{return{output,providerResponseId:`${this.providerId}-response`,returnedModel:request.model,finishState:"completed",usage:{inputTokens:10,outputTokens:20,reasoningTokens:3,cachedTokens:4,totalTokens:30},rawToolCalls:[{callId:"tool-1",name:"run_combinatorics_experiment",arguments:{maxVertices:6}}]}}
  async continueWithToolResults(request:GenerateStructuredRequest,previous:ProviderResponse,results:ToolResult[]){return{...previous,output:{...previous.output,summary:`${results.length} tool result accepted`},rawToolCalls:[]}}
}

for(const provider of ["openai","deepseek"] as const)test(`${provider} obeys the shared provider contract`,async()=>{const adapter=new MockAdapter(provider);const request={model:`${provider}-mock`,reasoning:"low" as const,maxOutputTokens:500,instructions:"test",input:"test"};const first=await adapter.generateStructured(request);assert.deepEqual(first.output,output);assert.equal(first.usage.cachedTokens,4);assert.equal(first.returnedModel,request.model);const continued=await adapter.continueWithToolResults(request,first,[{callId:"tool-1",name:"run_combinatorics_experiment",output:{violations:0}}]);assert.equal(continued.output.summary,"1 tool result accepted");assert.equal(continued.rawToolCalls.length,0)});

test("both live adapters expose only reviewed model ids",()=>{assert.deepEqual(new OpenAIAdapter("test").configuredModels().map((m)=>m.id),["gpt-5.6-luna","gpt-5.6-sol"]);assert.deepEqual(new DeepSeekAdapter("test").configuredModels().map((m)=>m.id),["deepseek-flash","deepseek-v4-pro"])});
test("usage and provider errors normalize without leaking provider fields",()=>{assert.deepEqual(normalizeUsage({input_tokens:12,output_tokens:7,input_tokens_details:{cached_tokens:5},output_tokens_details:{reasoning_tokens:2}}),{inputTokens:12,outputTokens:7,reasoningTokens:2,cachedTokens:5,totalTokens:19});assert.equal(normalizeHttpError("deepseek",429,"quota exhausted").code,"quota");assert.equal(normalizeHttpError("openai",401,"bad key").retryable,false)});
test("malformed structured output is rejected",()=>{assert.throws(()=>parseStageOutput("openai","not-json"),/invalid research result/i)});
