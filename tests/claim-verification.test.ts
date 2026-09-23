import assert from "node:assert/strict";
import test from "node:test";
import { collectEvidenceIds, verifyClaims } from "../lib/claim-verification";
import type { StageOutput } from "../lib/research-types";

const claim = (
  id: string,
  verificationStatus: StageOutput["claims"][number]["verificationStatus"],
  evidenceRefs: string[],
) => ({
  id,
  text: id,
  kind: "fact" as const,
  verificationStatus,
  evidenceRefs,
  warnings: [] as string[],
});
const output = (...claims: StageOutput["claims"]): StageOutput => ({
  summary: "s",
  claims,
  artifacts: [],
  openQuestions: [],
  suggestedNextSteps: [],
});

const tools = [
  { name: "search_literature", output: [{ id: "doi:10.1/real" }, { id: "arxiv:1234" }] },
  { name: "combinatorics-graph-kernel", output: { id: "triangle-free-n6", violations: 0 } },
];

test("evidence ids come from literature results and computation kernels", () => {
  const ids = collectEvidenceIds(tools);
  assert.deepEqual([...ids.sources], ["doi:10.1/real", "arxiv:1234"]);
  assert.deepEqual([...ids.computations], ["triangle-free-n6"]);
});

test("a failed literature search and a declined kernel contribute no evidence", () => {
  const ids = collectEvidenceIds([
    { name: "search_literature", output: { error: "unreachable" } },
    { name: "combinatorics-graph-kernel", output: null },
  ]);
  assert.equal(ids.sources.size + ids.computations.size, 0);
});

test("supported claims that cite recorded evidence are kept", () => {
  const result = verifyClaims(
    output(
      claim("a", "source-supported", ["doi:10.1/real"]),
      claim("b", "computation-supported", ["x", "triangle-free-n6"]),
    ),
    collectEvidenceIds(tools),
  );
  assert.deepEqual(
    result.claims.map((c) => c.verificationStatus),
    ["source-supported", "computation-supported"],
  );
  assert.deepEqual(
    result.claims.flatMap((c) => c.warnings),
    [],
  );
});

test("supported claims without recorded evidence are downgraded with a warning", () => {
  const result = verifyClaims(
    output(
      claim("a", "source-supported", ["doi:10.9/invented"]),
      claim("b", "computation-supported", []),
      claim("c", "source-supported", ["triangle-free-n6"]),
    ),
    collectEvidenceIds(tools),
  );
  assert.deepEqual(
    result.claims.map((c) => c.verificationStatus),
    ["unverified", "unverified", "unverified"],
  );
  assert.ok(result.claims.every((c) => /Downgraded by Lemma/.test(c.warnings[0])));
});

test("a source id cannot be used as computation evidence, or the reverse", () => {
  const ids = collectEvidenceIds(tools);
  assert.equal(
    verifyClaims(output(claim("a", "computation-supported", ["doi:10.1/real"])), ids).claims[0]
      .verificationStatus,
    "unverified",
  );
  assert.equal(
    verifyClaims(output(claim("b", "source-supported", ["triangle-free-n6"])), ids).claims[0]
      .verificationStatus,
    "unverified",
  );
});

test("claims that do not assert external support are never changed", () => {
  const ids = collectEvidenceIds([]);
  const statuses = ["internally-checked", "contested", "unverified"] as const;
  const result = verifyClaims(output(...statuses.map((s) => claim(s, s, []))), ids);
  assert.deepEqual(
    result.claims.map((c) => c.verificationStatus),
    [...statuses],
  );
});
