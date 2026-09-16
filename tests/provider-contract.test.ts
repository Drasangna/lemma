import assert from "node:assert/strict";
import test from "node:test";
import { OpenRouterAdapter } from "../lib/providers/openrouter";
import { normalizeHttpError, normalizeUsage, parseStageOutput } from "../lib/providers/shared";
import type { GenerateStructuredRequest, ModelProviderAdapter, ProviderResponse, ToolResult } from "../lib/providers/types";

const output={summary:"A bounded result.",claims:[{id:"c1",text:"Finite evidence only.",kind:"observation" as const,verificationStatus:"computation-supported" as const,evidenceRefs:["experiment-1"],warnings:[]}],artifacts:[],openQuestions:[],suggestedNextSteps:[]};
class MockAdapter implements ModelProviderAdapter {
  readonly capabilities={structuredOutput:true,functionTools:true,reasoningControls:false,streaming:true,usageReporting:true};
  readonly providerId="openrouter" as const;
  configuredModels(){return[{id:"mock/mock-model",label:"Mock",deep:false}]}
  async generateStructured(request:GenerateStructuredRequest):Promise<ProviderResponse>{return{output,providerResponseId:"openrouter-response",returnedModel:request.model,finishState:"completed",usage:{inputTokens:10,outputTokens:20,reasoningTokens:3,cachedTokens:4,totalTokens:30},rawToolCalls:[{callId:"tool-1",name:"run_combinatorics_experiment",arguments:{maxVertices:6}}]}}
  async continueWithToolResults(request:GenerateStructuredRequest,previous:ProviderResponse,results:ToolResult[]){return{...previous,output:{...previous.output,summary:`${results.length} tool result accepted`},rawToolCalls:[]}}
}

test("openrouter adapter obeys the shared provider contract",async()=>{const adapter=new MockAdapter();const request={model:"mock/mock-model",reasoning:"low" as const,maxOutputTokens:500,instructions:"test",input:"test"};const first=await adapter.generateStructured(request);assert.deepEqual(first.output,output);assert.equal(first.usage.cachedTokens,4);assert.equal(first.returnedModel,request.model);const continued=await adapter.continueWithToolResults(request,first,[{callId:"tool-1",name:"run_combinatorics_experiment",output:{violations:0}}]);assert.equal(continued.output.summary,"1 tool result accepted");assert.equal(continued.rawToolCalls.length,0)});

test("the live adapter exposes only reviewed model ids",()=>{assert.deepEqual(new OpenRouterAdapter("test").configuredModels().map((m)=>m.id),["deepseek/deepseek-chat","openai/gpt-4o-mini","openai/gpt-4o","deepseek/deepseek-reasoner"])});
test("the live adapter exposes no models without a configured key",()=>{assert.deepEqual(new OpenRouterAdapter(undefined).configuredModels(),[])});
test("usage and provider errors normalize from chat-completions fields",()=>{assert.deepEqual(normalizeUsage({prompt_tokens:12,completion_tokens:7,prompt_tokens_details:{cached_tokens:5},completion_tokens_details:{reasoning_tokens:2}}),{inputTokens:12,outputTokens:7,reasoningTokens:2,cachedTokens:5,totalTokens:19});assert.equal(normalizeHttpError("openrouter",429,"quota exhausted").code,"quota");assert.equal(normalizeHttpError("openrouter",401,"bad key").retryable,false)});
test("malformed structured output is rejected",()=>{assert.throws(()=>parseStageOutput("openrouter","not-json"),/invalid research result/i)});
