import assert from "node:assert/strict";
import test from "node:test";
import { graphAlgorithms, runCombinatoricsExperiment } from "../lib/tools/combinatorics";

test("Mantel benchmark finds no finite counterexample", () => {
  const result=runCombinatoricsExperiment("Every triangle-free graph satisfies e(G) ≤ floor(n²/4)",6);
  assert.equal(result.kind,"exhaustive-enumeration");
  assert.equal(result.violations,0);
  assert.ok(result.graphsChecked>0);
  assert.equal(result.parameters.vertices,6);
});

test("Petersen graph refutes the cubic Hamiltonian conjecture", () => {
  const result=runCombinatoricsExperiment("Every 3-regular graph is Hamiltonian",12);
  assert.equal(result.kind,"known-counterexample");
  assert.equal(result.witness?.name,"Petersen graph");
  assert.equal(result.witness?.vertices,10);
  assert.equal(graphAlgorithms.hasHamiltonianCycle(10,result.witness!.edges),false);
});
