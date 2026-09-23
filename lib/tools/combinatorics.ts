/**
 * A small, deterministic graph-theory kernel. It never executes model-written code: each check
 * below recognizes one family of statements and verifies it by exhaustive, bounded enumeration.
 */
type Edge = [number, number];

export type ExperimentResult = {
  id: string;
  kind: "exhaustive-enumeration" | "known-counterexample";
  algorithmVersion: string;
  parameters: Record<string, string | number | boolean>;
  graphsChecked: number;
  violations: number;
  summary: string;
  witness?: { name: string; vertices: number; edges: Edge[] };
};

const ALGORITHM_VERSION = "lemma-graph-kernel/1";
/** 2^15 labeled graphs on 6 vertices is instant; 7 vertices (2^21) would start to be noticeable. */
const MAX_ENUMERATED_VERTICES = 6;

// ---------------------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------------------

const PETERSEN: Edge[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0], // outer cycle
  [5, 7],
  [7, 9],
  [9, 6],
  [6, 8],
  [8, 5], // inner pentagram
  [0, 5],
  [1, 6],
  [2, 7],
  [3, 8],
  [4, 9], // spokes
];

function degrees(vertexCount: number, edges: Edge[]): number[] {
  const result = Array<number>(vertexCount).fill(0);
  for (const [a, b] of edges) {
    result[a]++;
    result[b]++;
  }
  return result;
}

export function hasHamiltonianCycle(vertexCount: number, edges: Edge[]): boolean {
  const neighbors = Array.from({ length: vertexCount }, () => new Set<number>());
  for (const [a, b] of edges) {
    neighbors[a].add(b);
    neighbors[b].add(a);
  }

  const visited = new Set([0]);
  let visitedCount = 1;
  const extend = (vertex: number): boolean => {
    if (visitedCount === vertexCount) return neighbors[vertex].has(0);
    for (const next of neighbors[vertex]) {
      if (visited.has(next)) continue;
      visited.add(next);
      visitedCount++;
      if (extend(next)) return true;
      visited.delete(next);
      visitedCount--;
    }
    return false;
  };
  return extend(0);
}

function countBits(mask: number): number {
  let count = 0;
  for (; mask; mask &= mask - 1) count++;
  return count;
}

// ---------------------------------------------------------------------------------------
// Checks: each returns a result, or null when the statement is not about that family
// ---------------------------------------------------------------------------------------

type Check = (statement: string, maxVertices: number) => ExperimentResult | null;

/** "Every 3-regular (cubic) graph is Hamiltonian" is false; the Petersen graph refutes it. */
const cubicHamiltonianCheck: Check = (statement, maxVertices) => {
  const text = statement.toLowerCase();
  if (!(text.includes("3-regular") || text.includes("cubic")) || !text.includes("hamilton")) return null;

  const isCubic = degrees(10, PETERSEN).every((degree) => degree === 3);
  const violations = isCubic && !hasHamiltonianCycle(10, PETERSEN) ? 1 : 0;
  return {
    id: "petersen-counterexample",
    kind: "known-counterexample",
    algorithmVersion: ALGORITHM_VERSION,
    parameters: { property: "cubic_hamiltonian", maxVertices },
    graphsChecked: 1,
    violations,
    summary: violations
      ? "The Petersen graph is 3-regular and has no Hamiltonian cycle, so it is a counterexample."
      : "The Petersen graph did not refute the statement.",
    witness: { name: "Petersen graph", vertices: 10, edges: PETERSEN },
  };
};

/** Mantel's theorem: a triangle-free graph on n vertices has at most floor(n^2/4) edges. */
const triangleFreeEdgeBoundCheck: Check = (statement, maxVertices) => {
  if (!/triangle/i.test(statement)) return null;

  const n = Math.max(1, Math.min(MAX_ENUMERATED_VERTICES, maxVertices));
  // Number the vertex pairs 0..P-1; a labeled graph is then a bitmask over the pairs.
  const pairIndex = (a: number, b: number) => (b * (b - 1)) / 2 + a; // requires a < b
  const triangles: number[] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++) {
        triangles.push((1 << pairIndex(a, b)) | (1 << pairIndex(a, c)) | (1 << pairIndex(b, c)));
      }

  const bound = Math.floor((n * n) / 4);
  let graphsChecked = 0;
  let violations = 0;
  for (let graph = 0; graph < 1 << ((n * (n - 1)) / 2); graph++) {
    if (triangles.some((triangle) => (graph & triangle) === triangle)) continue;
    graphsChecked++;
    if (countBits(graph) > bound) violations++;
  }

  return {
    id: `triangle-free-n${n}`,
    kind: "exhaustive-enumeration",
    algorithmVersion: ALGORITHM_VERSION,
    parameters: { property: "triangle_free_edge_bound", vertices: n, exhaustive: true },
    graphsChecked,
    violations,
    summary:
      violations === 0
        ? `Every triangle-free labeled graph on ${n} vertices satisfies e(G) ≤ ⌊n²/4⌋.`
        : `Found ${violations} violations among triangle-free graphs on ${n} vertices.`,
  };
};

const CHECKS: Check[] = [cubicHamiltonianCheck, triangleFreeEdgeBoundCheck];

/** Runs the first check that recognizes the statement; null means the kernel has nothing to say. */
export function runCombinatoricsExperiment(statement: string, maxVertices: number): ExperimentResult | null {
  for (const check of CHECKS) {
    const result = check(statement, maxVertices);
    if (result) return result;
  }
  return null;
}
