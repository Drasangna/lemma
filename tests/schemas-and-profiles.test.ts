import assert from "node:assert/strict";
import test from "node:test";
import { BUILT_IN_PROFILES } from "../lib/run-profiles";
import { problemSpecSchema, runProfileInputSchema, stageOutputSchema } from "../lib/research-types";

const base={title:"Test conjecture",field:"combinatorics" as const,statement:"A sufficiently detailed mathematical statement.",definitions:[],assumptions:[],knownResults:[],bounds:{minVertices:1,maxVertices:6},userSources:[]};
test("source import allows public HTTPS and rejects private networks",()=>{assert.equal(problemSpecSchema.parse({...base,userSources:[{title:"Paper",url:"https://arxiv.org/abs/1"}]}).userSources.length,1);assert.throws(()=>problemSpecSchema.parse({...base,userSources:[{title:"Internal",url:"https://127.0.0.1/paper"}]}));assert.throws(()=>problemSpecSchema.parse({...base,userSources:[{title:"Insecure",url:"http://example.com/paper"}]}))});
test("fabricated or unknown verification labels cannot enter a stage result",()=>{assert.throws(()=>stageOutputSchema.parse({summary:"x",claims:[{id:"c",text:"Fabricated citation proves it",kind:"fact",verificationStatus:"proved",evidenceRefs:[],warnings:[]}],artifacts:[],openQuestions:[],suggestedNextSteps:[]}))});
test("built-in profiles are explicit and capped",()=>{assert.equal(BUILT_IN_PROFILES["deepseek-economy"].stages.proofs.provider,"deepseek");assert.equal(BUILT_IN_PROFILES["mixed-economy"].stages.lemmas.provider,"openai");for(const profile of Object.values(BUILT_IN_PROFILES))assert.ok(profile.totalOutputLimit<=18_000)});
test("private profile validation requires every stage and enforces limits",()=>{const profile=BUILT_IN_PROFILES["openai-economy"];assert.doesNotThrow(()=>runProfileInputSchema.parse(profile));assert.throws(()=>runProfileInputSchema.parse({...profile,totalOutputLimit:18_001}))});
