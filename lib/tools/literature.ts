/** Literature search over Crossref and arXiv metadata. Metadata only: no full text is downloaded. */
export type LiteratureSource = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string;
  abstract: string | null;
  origin: "crossref" | "arxiv";
  verificationStatus: "metadata-verified";
};

const TIMEOUT_MS = 10_000;
const MAX_RESULTS = 12;

const stripMarkup = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const decodeXml = (value: string) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

// ---------------------------------------------------------------------------------------
// Parsing (exported for tests)
// ---------------------------------------------------------------------------------------

type CrossrefPayload = {
  message?: {
    items?: Array<{
      DOI?: string;
      title?: string[];
      author?: Array<{ given?: string; family?: string }>;
      published?: { "date-parts"?: number[][] };
      URL?: string;
      abstract?: string;
    }>;
  };
};

export function parseCrossref(payload: CrossrefPayload): LiteratureSource[] {
  const sources: LiteratureSource[] = [];
  for (const item of payload.message?.items ?? []) {
    const title = stripMarkup(item.title?.[0] ?? "");
    if (!title) continue;
    const doi = typeof item.DOI === "string" ? item.DOI : null;
    sources.push({
      id: doi ? `doi:${doi.toLowerCase()}` : `crossref:${crypto.randomUUID()}`,
      title,
      authors: (item.author ?? [])
        .map((a) => stripMarkup(`${a.given ?? ""} ${a.family ?? ""}`))
        .filter(Boolean),
      year: item.published?.["date-parts"]?.[0]?.[0] ?? null,
      doi,
      url: doi ? `https://doi.org/${doi}` : (item.URL ?? "https://www.crossref.org"),
      abstract: item.abstract ? stripMarkup(item.abstract) : null,
      origin: "crossref",
      verificationStatus: "metadata-verified",
    });
  }
  return sources;
}

export function parseArxiv(xml: string): LiteratureSource[] {
  const sources: LiteratureSource[] = [];
  for (const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
    const field = (tag: string) =>
      decodeXml(stripMarkup(entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? ""));
    const url = field("id");
    const title = field("title");
    if (!url || !title) continue;

    sources.push({
      id: `arxiv:${url.split("/").pop()}`,
      title,
      authors: [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map((m) =>
        decodeXml(stripMarkup(m[1])),
      ),
      year: Number(field("published").slice(0, 4)) || null,
      doi: null,
      url,
      abstract: field("summary") || null,
      origin: "arxiv",
      verificationStatus: "metadata-verified",
    });
  }
  return sources;
}

/** Drops repeats of the same paper (same DOI, else same normalized title), keeping the first. */
export function dedupeSources(sources: LiteratureSource[], limit: number): LiteratureSource[] {
  const unique = new Map<string, LiteratureSource>();
  for (const source of sources) {
    const key =
      source.doi?.toLowerCase() ??
      source.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 120);
    if (!unique.has(key)) unique.set(key, source);
  }
  return [...unique.values()].slice(0, limit);
}

// ---------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------

async function fetchOk(url: URL, userAgent: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url.hostname} responded with ${response.status}`);
  return response;
}

export async function searchLiterature(
  query: string,
  mailto?: string,
  limit = MAX_RESULTS,
): Promise<LiteratureSource[]> {
  const cap = Math.max(1, Math.min(MAX_RESULTS, limit));
  const userAgent = `LemmaResearch/1.0 (${mailto ?? "contact unavailable"})`;

  const crossrefUrl = new URL("https://api.crossref.org/works");
  crossrefUrl.searchParams.set("query.bibliographic", query);
  crossrefUrl.searchParams.set("rows", String(Math.min(8, cap)));
  crossrefUrl.searchParams.set("select", "DOI,title,author,published,URL,abstract");
  if (mailto) crossrefUrl.searchParams.set("mailto", mailto);

  const arxivUrl = new URL("https://export.arxiv.org/api/query");
  arxivUrl.searchParams.set("search_query", `all:${query}`);
  arxivUrl.searchParams.set("start", "0");
  arxivUrl.searchParams.set("max_results", String(Math.min(6, cap)));

  const [crossref, arxiv] = await Promise.allSettled([
    fetchOk(crossrefUrl, userAgent)
      .then((r) => r.json() as Promise<CrossrefPayload>)
      .then(parseCrossref),
    fetchOk(arxivUrl, userAgent)
      .then((r) => r.text())
      .then(parseArxiv),
  ]);

  // One source being down is fine; both being down must not look like "no papers exist".
  if (crossref.status === "rejected" && arxiv.status === "rejected") {
    throw new Error("Literature search failed: both Crossref and arXiv were unreachable.");
  }
  const found = [
    ...(crossref.status === "fulfilled" ? crossref.value : []),
    ...(arxiv.status === "fulfilled" ? arxiv.value : []),
  ];
  return dedupeSources(found, cap);
}
