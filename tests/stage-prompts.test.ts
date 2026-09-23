import assert from "node:assert/strict";
import test from "node:test";
import { stageInstructions } from "../lib/stage-prompts";

test("prove mode asks for lemmas toward a proof from scratch",()=>{assert.match(stageInstructions("lemmas","prove"),/intermediate statements/i)});
test("expand mode asks for generalizations from an existing proof",()=>{assert.match(stageInstructions("lemmas","expand"),/generalizations/i)});
test("expand mode reframes the proofs stage around the supplied proof",()=>{assert.match(stageInstructions("proofs","expand"),/existing supplied proof/i);assert.doesNotMatch(stageInstructions("proofs","expand"),/exactly two materially different/i)});
test("critique stage text is identical in both modes",()=>{assert.equal(stageInstructions("critique","prove"),stageInstructions("critique","expand"))});
test("mode defaults to prove when omitted",()=>{assert.equal(stageInstructions("lemmas"),stageInstructions("lemmas","prove"))});
