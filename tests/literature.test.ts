import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeSources,
  parseArxiv,
  parseCrossref,
  searchLiterature,
  type LiteratureSource,
} from "../lib/tools/literature";

const crossref = {
  message: {
    items: [
      {
        DOI: "10.1000/ABC",
        title: ["<i>Mantel</i> on graphs"],
        author: [{ given: "W.", family: "Mantel" }],
        published: { "date-parts": [[1907]] },
        abstract: "<jats:p>Edges &amp; triangles.</jats:p>",
      },
      { DOI: "10.1000/none" },
    ],
  },
};
const arxivXml = `<feed>
  <entry><id>http://arxiv.org/abs/1234.5678v1</id><title>Turán &amp; friends</title><published>2020-03-01T00:00:00Z</published>
    <summary> A summary. </summary><author><name>A. Author</name></author><author><name>B. Author</name></author></entry>
  <entry><id></id><title>No id</title></entry>
</feed>`;

test("crossref items are normalized, markup stripped, and untitled items dropped", () => {
  const [source, ...rest] = parseCrossref(crossref);
  assert.equal(rest.length, 0);
  assert.equal(source.id, "doi:10.1000/abc");
  assert.equal(source.title, "Mantel on graphs");
  assert.deepEqual(source.authors, ["W. Mantel"]);
  assert.equal(source.year, 1907);
  assert.equal(source.url, "https://doi.org/10.1000/ABC");
  assert.equal(source.origin, "crossref");
});

test("arxiv entries are normalized and entries without an id are dropped", () => {
  const [source, ...rest] = parseArxiv(arxivXml);
  assert.equal(rest.length, 0);
  assert.equal(source.id, "arxiv:1234.5678v1");
  assert.equal(source.title, "Turán & friends");
  assert.deepEqual(source.authors, ["A. Author", "B. Author"]);
  assert.equal(source.year, 2020);
  assert.equal(source.abstract, "A summary.");
});

test("duplicates are removed by DOI or normalized title, and the limit applies", () => {
  const make = (title: string, doi: string | null): LiteratureSource => ({
    id: title,
    title,
    authors: [],
    year: null,
    doi,
    url: "https://x.org",
    abstract: null,
    origin: "crossref",
    verificationStatus: "metadata-verified",
  });
  const unique = dedupeSources(
    [
      make("A Paper", "10.1/x"),
      make("Different title", "10.1/X"),
      make("The  Paper!", null),
      make("the paper", null),
      make("Third", null),
    ],
    10,
  );
  assert.deepEqual(
    unique.map((s) => s.title),
    ["A Paper", "The  Paper!", "Third"],
  );
  assert.equal(dedupeSources(unique, 2).length, 2);
});

test("search survives one source being down but reports when both are", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: unknown) =>
      String(url).includes("crossref")
        ? Response.json(crossref)
        : new Response("down", { status: 503 })) as typeof fetch;
    assert.equal((await searchLiterature("graphs")).length, 1);

    globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
    await assert.rejects(searchLiterature("graphs"), /both Crossref and arXiv/);
  } finally {
    globalThis.fetch = original;
  }
});
