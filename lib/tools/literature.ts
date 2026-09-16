export type LiteratureSource={id:string;title:string;authors:string[];year:number|null;doi:string|null;url:string;abstract:string|null;origin:"crossref"|"arxiv"|"user";verificationStatus:"metadata-verified"|"user-supplied"|"unverified"};
type CrossrefAuthor={given?:string;family?:string};
type CrossrefItem={DOI?:string;title?:string[];author?:CrossrefAuthor[];published?:{"date-parts"?:number[][]};URL?:string;abstract?:string};
type CrossrefPayload={message?:{items?:CrossrefItem[]}};

const clean=(value:string)=>value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const decodeXml=(value:string)=>value.replaceAll("&amp;","&").replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&quot;",'"').replaceAll("&#39;", "'");

export async function searchLiterature(query:string,mailto?:string,limit=12):Promise<LiteratureSource[]>{
  const safeLimit=Math.max(1,Math.min(12,limit)); const results:LiteratureSource[]=[];
  const crossrefUrl=new URL("https://api.crossref.org/works");crossrefUrl.searchParams.set("query.bibliographic",query);crossrefUrl.searchParams.set("rows",String(Math.min(8,safeLimit)));crossrefUrl.searchParams.set("select","DOI,title,author,published,URL,abstract");if(mailto)crossrefUrl.searchParams.set("mailto",mailto);
  const arxivUrl=new URL("https://export.arxiv.org/api/query");arxivUrl.searchParams.set("search_query",`all:${query}`);arxivUrl.searchParams.set("start","0");arxivUrl.searchParams.set("max_results",String(Math.min(6,safeLimit)));
  const [crossref,arxiv]=await Promise.allSettled([fetch(crossrefUrl,{headers:{"User-Agent":`LemmaResearch/1.0 (${mailto??"contact unavailable"})`}}),fetch(arxivUrl,{headers:{"User-Agent":"LemmaResearch/1.0"}})]);
  if(crossref.status==="fulfilled"&&crossref.value.ok){const body=await crossref.value.json() as CrossrefPayload;for(const item of body.message?.items??[]){const doi=typeof item.DOI==="string"?item.DOI:null;const title=clean(item.title?.[0]??"");if(!title)continue;results.push({id:doi?`doi:${doi.toLowerCase()}`:`crossref:${crypto.randomUUID()}`,title,authors:(item.author??[]).map((a)=>clean(`${a.given??""} ${a.family??""}`)).filter(Boolean),year:item.published?.["date-parts"]?.[0]?.[0]??null,doi,url:doi?`https://doi.org/${doi}`:item.URL??"https://www.crossref.org",abstract:item.abstract?clean(item.abstract):null,origin:"crossref",verificationStatus:"metadata-verified"})}}
  if(arxiv.status==="fulfilled"&&arxiv.value.ok){const xml=await arxiv.value.text();for(const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g)??[]){const pick=(tag:string)=>decodeXml(clean(entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]??""));const id=pick("id");const title=pick("title");if(!id||!title)continue;const authors=[...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map((m)=>decodeXml(clean(m[1])));const year=Number(pick("published").slice(0,4))||null;results.push({id:`arxiv:${id.split("/").pop()}`,title,authors,year,doi:null,url:id,abstract:pick("summary")||null,origin:"arxiv",verificationStatus:"metadata-verified"})}}
  const deduped=new Map<string,LiteratureSource>();for(const source of results){const key=source.doi?.toLowerCase()??source.title.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,120);if(!deduped.has(key))deduped.set(key,source)}
  return [...deduped.values()].slice(0,safeLimit);
}
