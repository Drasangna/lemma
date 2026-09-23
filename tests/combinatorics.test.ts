import assert from "node:assert/strict";
import test from "node:test";
import { hasHamiltonianCycle, runCombinatoricsExperiment } from "../lib/tools/combinatorics";

test("Mantel benchmark finds no finite counterexample", () => {
  const result = runCombinatoricsExperiment("Every triangle-free graph satisfies e(G) ≤ floor(n²/4)", 6)!;
  assert.equal(result.kind, "exhaustive-enumeration");
  assert.equal(result.violations, 0);
  assert.equal(result.parameters.vertices, 6);
  assert.equal(result.graphsChecked, 5789); // labeled triangle-free graphs on 6 vertices
});

test("enumeration counts match known values for small n", () => {
  const counts = [1, 2, 3, 4, 5].map((n) => runCombinatoricsExperiment("triangle-free", n)!.graphsChecked);
  assert.deepEqual(counts, [1, 2, 7, 41, 388]);
});

test("the vertex bound is capped so the enumeration stays fast", () => {
  assert.equal(runCombinatoricsExperiment("triangle-free", 12)!.parameters.vertices, 6);
});

test("Petersen graph refutes the cubic Hamiltonian conjecture", () => {
  const result = runCombinatoricsExperiment("Every 3-regular graph is Hamiltonian", 12)!;
  assert.equal(result.kind, "known-counterexample");
  assert.equal(result.violations, 1);
  assert.equal(result.witness?.name, "Petersen graph");
  assert.equal(result.witness?.vertices, 10);
  assert.equal(hasHamiltonianCycle(10, result.witness!.edges), false);
});

test("hasHamiltonianCycle accepts cycles and rejects paths", () => {
  const cycle: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];
  assert.equal(hasHamiltonianCycle(4, cycle), true);
  assert.equal(hasHamiltonianCycle(4, cycle.slice(0, 3)), false);
});

test("statements the kernel cannot check yield no result", () => {
  assert.equal(runCombinatoricsExperiment("Every planar graph is 4-colorable", 6), null);
});
