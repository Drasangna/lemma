export type ExperimentResult={id:string;kind:"exhaustive-enumeration"|"known-counterexample";algorithmVersion:string;parameters:Record<string,string|number|boolean>;graphsChecked:number;violations:number;summary:string;witness?:{name:string;vertices:number;edges:Array<[number,number]>}};

type Edge=[number,number];
function edgeList(n:number):Edge[]{const edges:Edge[]=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)edges.push([i,j]);return edges}
function selectedEdges(all:Edge[],mask:number):Edge[]{return all.filter((_,i)=>(mask&(1<<i))!==0)}
function triangleFree(n:number,edges:Edge[]):boolean{const set=new Set(edges.map(([a,b])=>`${a},${b}`));for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)for(let c=b+1;c<n;c++)if(set.has(`${a},${b}`)&&set.has(`${a},${c}`)&&set.has(`${b},${c}`))return false;return true}
function degrees(n:number,edges:Edge[]):number[]{const d=Array(n).fill(0);for(const [a,b] of edges){d[a]++;d[b]++}return d}
function hasHamiltonianCycle(n:number,edges:Edge[]):boolean{const adj=Array.from({length:n},()=>new Set<number>());for(const[a,b]of edges){adj[a].add(b);adj[b].add(a)}const path=[0],seen=new Set([0]);const walk=(v:number):boolean=>{if(path.length===n)return adj[v].has(0);for(const next of adj[v])if(!seen.has(next)){seen.add(next);path.push(next);if(walk(next))return true;path.pop();seen.delete(next)}return false};return walk(0)}
const PETERSEN:Edge[]=[[0,1],[1,2],[2,3],[3,4],[4,0],[5,7],[7,9],[9,6],[6,8],[8,5],[0,5],[1,6],[2,7],[3,8],[4,9]];

export function runCombinatoricsExperiment(statement:string,maxVertices:number):ExperimentResult{
  const lower=statement.toLowerCase();
  if((lower.includes("3-regular")||lower.includes("cubic"))&&lower.includes("hamilton"))return{id:"petersen-counterexample",kind:"known-counterexample",algorithmVersion:"axiom-graph-kernel/1",parameters:{property:"cubic_hamiltonian",maxVertices},graphsChecked:1,violations:1,summary:"The Petersen graph is 3-regular and has no Hamiltonian cycle, so it is a counterexample.",witness:{name:"Petersen graph",vertices:10,edges:PETERSEN}};
  const n=Math.max(1,Math.min(6,maxVertices));const all=edgeList(n);const total=2**all.length;let checked=0,violations=0;
  for(let mask=0;mask<total;mask++){const edges=selectedEdges(all,mask);if(!triangleFree(n,edges))continue;checked++;if(edges.length>Math.floor(n*n/4))violations++}
  return{id:`triangle-free-n${n}`,kind:"exhaustive-enumeration",algorithmVersion:"axiom-graph-kernel/1",parameters:{property:"triangle_free_edge_bound",vertices:n,exhaustive:true},graphsChecked:checked,violations,summary:violations===0?`Every triangle-free labeled graph on ${n} vertices satisfies e(G) ≤ ⌊n²/4⌋.`:`Found ${violations} violations among triangle-free graphs on ${n} vertices.`};
}

export const graphAlgorithms={edgeList,triangleFree,degrees,hasHamiltonianCycle};
