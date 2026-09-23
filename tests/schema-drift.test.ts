/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { stageOutputJsonSchema, stageOutputSchema } from "../lib/research-types";

// `stageOutputJsonSchema` is what the model is told to produce; `stageOutputSchema` is what we
// accept. These tests fail if someone edits one and forgets the other.

const json = stageOutputJsonSchema as any;
const claimShape = (stageOutputSchema.shape.claims.element as any).shape;
const artifactShape = (stageOutputSchema.shape.artifacts._def.innerType.element as any).shape;

test("top-level fields match", () => {
  assert.deepEqual(Object.keys(json.properties).sort(), Object.keys(stageOutputSchema.shape).sort());
  assert.deepEqual([...json.required].sort(), Object.keys(stageOutputSchema.shape).sort());
});

test("claim fields and enums match", () => {
  const schema = json.properties.claims.items;
  assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(claimShape).sort());
  assert.deepEqual([...schema.required].sort(), Object.keys(claimShape).sort());
  assert.deepEqual(schema.properties.kind.enum, claimShape.kind.options);
  assert.deepEqual(schema.properties.verificationStatus.enum, claimShape.verificationStatus.options);
});

test("artifact fields and enums match", () => {
  const schema = json.properties.artifacts.items;
  assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(artifactShape).sort());
  assert.deepEqual(schema.properties.type.enum, artifactShape.type.options);
});

test("the claim vocabulary never includes a proved status", () => {
  assert.ok(!claimShape.verificationStatus.options.includes("proved"));
});
