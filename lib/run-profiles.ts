import type { ModelRef, RunProfile, StageId } from "./research-types";
const deepseek:ModelRef={provider:"deepseek",model:"deepseek-flash",reasoning:"low",maxOutputTokens:3000};
const openai:ModelRef={provider:"openai",model:"gpt-5.6-luna",reasoning:"low",maxOutputTokens:3000};
const all=(ref:ModelRef)=>Object.fromEntries(["normalize","evidence","lemmas","proofs","critique","synthesis"].map((stage)=>[stage,{...ref}])) as Record<StageId,ModelRef>;
export const BUILT_IN_PROFILES:Record<string,RunProfile>={
  "deepseek-economy":{id:"deepseek-economy",name:"DeepSeek Economy",totalOutputLimit:18000,stages:all(deepseek)},
  "openai-economy":{id:"openai-economy",name:"OpenAI Economy",totalOutputLimit:18000,stages:all(openai)},
  "mixed-economy":{id:"mixed-economy",name:"Mixed Economy",totalOutputLimit:18000,stages:{normalize:deepseek,evidence:deepseek,lemmas:openai,proofs:openai,critique:openai,synthesis:deepseek}},
};
export function getBuiltInProfile(id:string):RunProfile|null{return BUILT_IN_PROFILES[id]?structuredClone(BUILT_IN_PROFILES[id]):null}
