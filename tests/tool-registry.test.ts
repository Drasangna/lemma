import assert from "node:assert/strict";
import test from "node:test";
import { applicableKernels } from "../lib/tools/registry";
import type { ProblemSpec } from "../lib/research-types";

const base:ProblemSpec={title:"Test conjecture",field:"combinatorics",statement:"If G is triangle-free on n vertices, e(G) <= floor(n^2/4).",definitions:[],assumptions:[],knownResults:[],bounds:{minVertices:1,maxVertices:6},mode:"prove",userSources:[]};

test("the graph kernel applies to combinatorics-flavored fields",()=>{const kernels=applicableKernels(base);assert.equal(kernels.length,1);assert.equal(kernels[0].id,"combinatorics-graph-kernel")});
test("the graph kernel does not apply to unrelated fields",()=>{assert.deepEqual(applicableKernels({...base,field:"number theory"}),[]);assert.deepEqual(applicableKernels({...base,field:"analysis"}),[])});
test("the graph kernel still runs without explicit bounds",()=>{const [kernel]=applicableKernels({...base,bounds:undefined});const result=kernel.run({...base,bounds:undefined}) as {id:string};assert.equal(typeof result.id,"string")});
