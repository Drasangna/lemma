import { COMBINATORICS_FIELD_PATTERN, type ProblemSpec } from "../research-types";
import { runCombinatoricsExperiment } from "./combinatorics";

export type ComputationKernel = { id: string; appliesTo(problem: ProblemSpec): boolean; run(problem: ProblemSpec): unknown };

export const computationKernels: ComputationKernel[] = [
  {
    id: "combinatorics-graph-kernel",
    appliesTo: (problem) => COMBINATORICS_FIELD_PATTERN.test(problem.field),
    run: (problem) => runCombinatoricsExperiment(problem.statement, problem.bounds?.maxVertices ?? 6),
  },
];

export function applicableKernels(problem: ProblemSpec): ComputationKernel[] {
  return computationKernels.filter((k) => k.appliesTo(problem));
}
