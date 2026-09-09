import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Legacy compatibility function. Active app search uses Next.js
// /api/search/resources so source controls, review staging, and legal-download
// policy stay centralized.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAILTO = "library@esut.edu.ng";
const SEMANTIC_SCHOLAR_KEY = Deno.env.get("SEMANTIC_SCHOLAR_KEY") ?? "";
const CORE_API_KEY = Deno.env.get("CORE_API_KEY") ?? "";
const NCBI_API_KEY = Deno.env.get("NCBI_API_KEY") ?? "";
const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY") ?? "";
const AI_GATEWAY = `${(Deno.env.get("AI_GATEWAY_BASE_URL") ?? "https://ai-gateway.vercel.sh/v1").replace(/\/$/, "")}/chat/completions`;
const AI_MODEL = Deno.env.get("AI_FAST_MODEL") ?? Deno.env.get("AI_DEFAULT_MODEL") ?? "openai/gpt-4o-mini";

interface SearchResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  abstract: string;
  doi: string | null;
  url: string | null;
  source: string;
  sourceTag: string;
  pdf_url: string | null;
}

async function fetchUnpaywall(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${MAILTO}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.best_oa_location?.url_for_pdf ?? data.best_oa_location?.url ?? null;
  } catch { return null; }
}

async function searchLocal(query: string, supabase: any): Promise<SearchResult[]> {
  const [catRes, repRes] = await Promise.all([
    supabase
      .from("catalogue_items")
      .select("id, title, authors, publication_year, abstract, isbn, source_url")
      .or(`title.ilike.%${query}%,authors.ilike.%${query}%,abstract.ilike.%${query}%`)
      .limit(5),
    supabase
      .from("repository_items")
      .select("id, title, author_names, year, abstract, doi, file_url")
      .or(`title.ilike.%${query}%,author_names.ilike.%${query}%,abstract.ilike.%${query}%`)
      .limit(5),
  ]);

  const cat: SearchResult[] = (catRes.data ?? []).map((r: any) => ({
    id: `cat-${r.id}`,
    title: r.title ?? "",
    authors: r.authors ?? "",
    year: r.publication_year ?? null,
    abstract: r.abstract ?? "",
    doi: null,
    url: r.source_url ?? null,
    source: "ESUT Library",
    sourceTag: "ESUT Library",
    pdf_url: null,
  }));

  const rep: SearchResult[] = (repRes.data ?? []).map((r: any) => ({
    id: `rep-${r.id}`,
    title: r.title ?? "",
    authors: Array.isArray(r.author_names) ? r.author_names.join(", ") : (r.author_names ?? ""),
    year: r.year ?? null,
    abstract: r.abstract ?? "",
    doi: r.doi ?? null,
    url: r.file_url ?? null,
    source: "ESUT Repository",
    sourceTag: "ESUT Library",
    pdf_url: r.file_url ?? null,
  }));

  return [...cat, ...rep];
}

async function searchOpenAlex(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=publication_year:%3E2019&mailto=${MAILTO}&per-page=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((w: any) => ({
      id: `oa-${w.id}`,
      title: w.title ?? "",
      authors: (w.authorships ?? []).slice(0, 3).map((a: any) => a.author?.display_name ?? "").join(", "),
      year: w.publication_year ?? null,
      abstract: w.abstract ?? "",
      doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
      url: w.primary_location?.landing_page_url ?? null,
      source: "OpenAlex",
      sourceTag: "OpenAlex — Open Access",
      pdf_url: w.primary_location?.pdf_url ?? null,
    }));
  } catch { return []; }
}

async function searchCrossref(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&filter=from-pub-date:2019&rows=5&mailto=${MAILTO}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.message?.items ?? []).map((w: any) => ({
      id: `cr-${w.DOI}`,
      title: Array.isArray(w.title) ? w.title[0] : (w.title ?? ""),
      authors: (w.author ?? []).slice(0, 3).map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).join(", "),
      year: w.published?.["date-parts"]?.[0]?.[0] ?? null,
      abstract: w.abstract ? w.abstract.replace(/<[^>]+>/g, "") : "",
      doi: w.DOI ?? null,
      url: w.URL ?? null,
      source: "Crossref",
      sourceTag: "Crossref",
      pdf_url: null,
    }));
  } catch { return []; }
}

async function searchSemanticScholar(query: string): Promise<SearchResult[]> {
  try {
    const headers: Record<string, string> = {};
    if (SEMANTIC_SCHOLAR_KEY) headers["x-api-key"] = SEMANTIC_SCHOLAR_KEY;
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,authors,year,abstract,tldr,externalIds,openAccessPdf`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((p: any) => ({
      id: `ss-${p.paperId}`,
      title: p.title ?? "",
      authors: (p.authors ?? []).slice(0, 3).map((a: any) => a.name ?? "").join(", "),
      year: p.year ?? null,
      abstract: p.abstract ?? p.tldr?.text ?? "",
      doi: p.externalIds?.DOI ?? null,
      url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null,
      source: "Semantic Scholar",
      sourceTag: "Semantic Scholar",
      pdf_url: p.openAccessPdf?.url ?? null,
    }));
  } catch { return []; }
}

async function searchCORE(query: string): Promise<SearchResult[]> {
  if (!CORE_API_KEY) return [];
  try {
    const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${CORE_API_KEY}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((w: any) => ({
      id: `core-${w.id}`,
      title: w.title ?? "",
      authors: (w.authors ?? []).slice(0, 3).map((a: any) => a.name ?? "").join(", "),
      year: w.yearPublished ?? null,
      abstract: w.abstract ?? "",
      doi: w.doi ?? null,
      url: w.downloadUrl ?? w.sourceFulltextUrls?.[0] ?? null,
      source: "CORE",
      sourceTag: "CORE — Open Access",
      pdf_url: w.downloadUrl ?? null,
    }));
  } catch { return []; }
}

async function searchPubMed(query: string): Promise<SearchResult[]> {
  try {
    const keyParam = NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : "";
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5${keyParam}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids: string[] = searchData.esearchresult?.idlist ?? [];
    if (!ids.length) return [];

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${keyParam}`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) return [];
    const fetchData = await fetchRes.json();

    return ids.map((id: string) => {
      const art = fetchData.result?.[id];
      if (!art) return null;
      const authors = (art.authors ?? []).slice(0, 3).map((a: any) => a.name ?? "").join(", ");
      return {
        id: `pm-${id}`,
        title: art.title ?? "",
        authors,
        year: art.pubdate ? parseInt(art.pubdate.slice(0, 4)) : null,
        abstract: "",
        doi: art.elocationid?.startsWith("doi:") ? art.elocationid.replace("doi: ", "").replace("doi:", "") : null,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        source: "PubMed",
        sourceTag: "PubMed",
        pdf_url: null,
      };
    }).filter(Boolean) as SearchResult[];
  } catch { return []; }
}

async function searchInternetArchive(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}+AND+mediatype:texts&output=json&rows=5&fl=title,creator,year,identifier`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.response?.docs ?? []).map((d: any) => ({
      id: `ia-${d.identifier}`,
      title: Array.isArray(d.title) ? d.title[0] : (d.title ?? ""),
      authors: Array.isArray(d.creator) ? d.creator.slice(0, 3).join(", ") : (d.creator ?? ""),
      year: d.year ? parseInt(d.year) : null,
      abstract: "",
      doi: null,
      url: `https://archive.org/details/${d.identifier}`,
      source: "Internet Archive",
      sourceTag: "Internet Archive",
      pdf_url: `https://archive.org/download/${d.identifier}/${d.identifier}.pdf`,
    }));
  } catch { return []; }
}

async function searchAJOL(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://www.ajol.info/index.php/search?query=${encodeURIComponent(query)}&searchField=all`;
    const res = await fetch(url, { headers: { "User-Agent": "ESUT Library Research Bot/1.0" } });
    if (!res.ok) return [];
    const html = await res.text();

    // Parse article entries from AJOL HTML response
    const results: SearchResult[] = [];
    const titleRe = /<a[^>]+class="[^"]*article[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const authorRe = /<span[^>]+class="[^"]*authors[^"]*"[^>]*>([^<]+)<\/span>/gi;

    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = titleRe.exec(html)) !== null && idx < 5) {
      const url = m[1].startsWith("http") ? m[1] : `https://www.ajol.info${m[1]}`;
      const title = m[2].trim().replace(/&amp;/g, "&");
      if (title.length < 5) continue;
      results.push({
        id: `ajol-${idx}`,
        title,
        authors: "",
        year: null,
        abstract: "",
        doi: null,
        url,
        source: "AJOL",
        sourceTag: "AJOL — African Journals",
        pdf_url: null,
      });
      idx++;
    }
    return results;
  } catch { return []; }
}

// ── New open-access sources ────────────────────────────────────────────────

async function searchGutenberg(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en,yo`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 5).map((b: any) => {
      const pdfUrl = b.formats?.["application/pdf"] ?? b.formats?.["text/html"] ?? null;
      const epubUrl = b.formats?.["application/epub+zip"] ?? null;
      return {
        id: `gutenberg-${b.id}`,
        title: b.title ?? "Unknown",
        authors: (b.authors ?? []).map((a: any) => a.name).join("; "),
        year: b.birth_year ? null : null,
        abstract: (b.subjects ?? []).slice(0, 5).join(", "),
        doi: null,
        url: `https://www.gutenberg.org/ebooks/${b.id}`,
        source: "Project Gutenberg",
        sourceTag: "Project Gutenberg — Free Ebook",
        pdf_url: pdfUrl,
        cover_url: b.formats?.["image/jpeg"] ?? null,
        download_url: epubUrl ?? pdfUrl,
        read_url: `https://www.gutenberg.org/ebooks/${b.id}`,
      };
    });
  } catch { return []; }
}

async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,first_publish_year,isbn,subject,has_fulltext,cover_i&has_fulltext=true&limit=5`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).slice(0, 5).map((b: any) => ({
      id: `openlibrary-${b.key?.replace("/works/", "")}`,
      title: b.title ?? "Unknown",
      authors: (b.author_name ?? []).slice(0, 3).join("; "),
      year: b.first_publish_year ?? null,
      abstract: (b.subject ?? []).slice(0, 5).join(", "),
      doi: null,
      url: `https://openlibrary.org${b.key}`,
      source: "Open Library",
      sourceTag: "Open Library — Free to Read",
      pdf_url: null,
      cover_url: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
      download_url: null,
      read_url: `https://openlibrary.org${b.key}`,
    }));
  } catch { return []; }
}

async function searchOAPEN(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://library.oapen.org/rest/search?query=${encodeURIComponent(query)}&expand=metadata&offset=0&limit=5`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.slice(0, 5).map((b: any) => {
      const meta = (b.metadata ?? []).reduce((acc: any, m: any) => { acc[m.key] = m.value; return acc; }, {});
      const doi = meta["dc.identifier.doi"] ?? meta["dc.identifier"] ?? null;
      return {
        id: `oapen-${b.uuid ?? b.id}`,
        title: meta["dc.title"] ?? b.name ?? "Unknown",
        authors: meta["dc.contributor.author"] ?? "",
        year: parseInt(meta["dc.date.issued"] ?? "") || null,
        abstract: meta["dc.description.abstract"] ?? meta["dc.description"] ?? "",
        doi: doi ? doi.replace(/^https?:\/\/doi\.org\//, "") : null,
        url: doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : `https://library.oapen.org/handle/${b.handle ?? ""}`,
        source: "OAPEN",
        sourceTag: "OAPEN — Open Access Book",
        pdf_url: meta["dc.identifier.uri"] ?? null,
        cover_url: null,
        download_url: meta["dc.identifier.uri"] ?? null,
        read_url: doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : null,
      };
    });
  } catch { return []; }
}

async function searchDOAB(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://directory.doabooks.org/rest/search?query=${encodeURIComponent(query)}&expand=metadata&limit=5`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.slice(0, 5).map((b: any) => {
      const meta = (b.metadata ?? []).reduce((acc: any, m: any) => { acc[m.key] = m.value; return acc; }, {});
      const doi = meta["dc.identifier.doi"] ?? null;
      return {
        id: `doab-${b.uuid ?? b.id}`,
        title: meta["dc.title"] ?? b.name ?? "Unknown",
        authors: meta["dc.contributor.author"] ?? "",
        year: parseInt(meta["dc.date.issued"] ?? "") || null,
        abstract: meta["dc.description.abstract"] ?? meta["dc.description"] ?? "",
        doi: doi ? doi.replace(/^https?:\/\/doi\.org\//, "") : null,
        url: doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : null,
        source: "DOAB",
        sourceTag: "DOAB — Peer-Reviewed Open Access",
        pdf_url: null,
        cover_url: null,
        download_url: null,
        read_url: doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : null,
      };
    });
  } catch { return []; }
}

async function searchGoogleBooksFree(query: string): Promise<SearchResult[]> {
  const GOOGLE_BOOKS_KEY = Deno.env.get("GOOGLE_BOOKS_KEY") ?? "";
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&filter=free-ebooks&maxResults=5&fields=items(id,volumeInfo,accessInfo)${GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).filter((b: any) =>
      b.accessInfo?.viewability === "ALL_PAGES" || b.accessInfo?.viewability === "PARTIAL"
    ).slice(0, 5).map((b: any) => ({
      id: `gbooks-${b.id}`,
      title: b.volumeInfo?.title ?? "Unknown",
      authors: (b.volumeInfo?.authors ?? []).join("; "),
      year: parseInt(b.volumeInfo?.publishedDate ?? "") || null,
      abstract: b.volumeInfo?.description ?? "",
      doi: null,
      url: b.volumeInfo?.canonicalVolumeLink ?? b.accessInfo?.webReaderLink ?? null,
      source: "Google Books",
      sourceTag: "Google Books — Free Preview",
      pdf_url: b.accessInfo?.viewability === "ALL_PAGES" ? (b.accessInfo?.pdf?.downloadLink ?? null) : null,
      cover_url: b.volumeInfo?.imageLinks?.thumbnail ?? null,
      download_url: b.accessInfo?.pdf?.downloadLink ?? null,
      read_url: b.accessInfo?.webReaderLink ?? null,
    }));
  } catch { return []; }
}

async function searchBASE(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?func=MatchingRecords&query=${encodeURIComponent(query)}&hits=5&offset=0&format=json`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const records = data.response?.docs ?? [];
    return records.slice(0, 5).map((r: any) => ({
      id: `base-${r.dcdoi ?? r.dcidentifier?.[0] ?? Math.random().toString(36).slice(2)}`,
      title: r.dctitle ?? "Unknown",
      authors: (r.dccreator ?? []).slice(0, 3).join("; "),
      year: parseInt(r.dcyear ?? "") || null,
      abstract: r.dcdescription ?? "",
      doi: r.dcdoi ?? null,
      url: (r.dclink ?? r.dcidentifier ?? [])[0] ?? null,
      source: "BASE",
      sourceTag: "BASE — Academic Search Engine",
      pdf_url: null,
      cover_url: null,
      download_url: null,
      read_url: (r.dclink ?? r.dcidentifier ?? [])[0] ?? null,
    }));
  } catch { return []; }
}

async function searchDOAJArticles(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=5&sort=publishedAt:desc`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 5).map((a: any) => {
      const bib = a.bibjson ?? {};
      const doi = (bib.identifier ?? []).find((i: any) => i.type === "doi")?.id ?? null;
      const fulltext = (bib.link ?? []).find((l: any) => l.type === "fulltext")?.url ?? null;
      return {
        id: `doaj-${a.id}`,
        title: bib.title ?? "Unknown",
        authors: (bib.author ?? []).map((au: any) => au.name).join("; "),
        year: bib.year ? parseInt(bib.year) : null,
        abstract: bib.abstract ?? "",
        doi,
        url: fulltext ?? (doi ? `https://doi.org/${doi}` : null),
        source: "DOAJ",
        sourceTag: "DOAJ — Free Journal",
        pdf_url: fulltext,
        cover_url: null,
        download_url: fulltext,
        read_url: fulltext,
      };
    });
  } catch { return []; }
}

async function generateAISummary(query: string, results: SearchResult[]): Promise<string> {
  if (!AI_GATEWAY_API_KEY || !results.length) return "";
  const top3 = results.slice(0, 3).map(r =>
    `Title: ${r.title}\nAuthors: ${r.authors}\nAbstract: ${r.abstract.slice(0, 300)}`
  ).join("\n\n");

  try {
    const res = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Summarise these search results for a student at a Nigerian college of education searching for: "${query}". Give a 2–3 sentence overview in plain English.\n\n${top3}`,
        }],
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch { return ""; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { query } = await req.json();
    if (!query?.trim()) return json({ error: "query required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Run all sources in parallel
    const [local, openAlex, crossref, semanticScholar, core, pubMed, archive, ajol,
           gutenberg, openLibrary, oapen, doab, googleBooksFree, base, doajArticles] =
      await Promise.all([
        searchLocal(query, supabase),
        searchOpenAlex(query),
        searchCrossref(query),
        searchSemanticScholar(query),
        searchCORE(query),
        searchPubMed(query),
        searchInternetArchive(query),
        searchAJOL(query),
        searchGutenberg(query),
        searchOpenLibrary(query),
        searchOAPEN(query),
        searchDOAB(query),
        searchGoogleBooksFree(query),
        searchBASE(query),
        searchDOAJArticles(query),
      ]);

    const ebooks = [...gutenberg, ...openLibrary, ...oapen, ...doab, ...googleBooksFree];
    const journals = [...doajArticles, ...base];
    const all = [...local, ...openAlex, ...crossref, ...semanticScholar, ...core, ...pubMed, ...archive, ...ajol, ...ebooks, ...journals];

    // Enrich DOIs with Unpaywall in parallel
    const doiResults = all.filter(r => r.doi && !r.pdf_url);
    const unpaywall = await Promise.all(
      doiResults.map(r => fetchUnpaywall(r.doi!))
    );
    doiResults.forEach((r, i) => { if (unpaywall[i]) r.pdf_url = unpaywall[i]; });

    // AI summary using top results
    const topResults = [...local, ...openAlex, ...semanticScholar].filter(r => r.abstract);
    const aiSummary = await generateAISummary(query, topResults);

    return json({
      aiSummary,
      local,
      openAccess: [...openAlex, ...core],
      crossref,
      semanticScholar,
      pubMed,
      archive,
      ajol,
      ebooks,
      journals,
      all,
    });
  } catch (err) {
    console.error("federated-search error:", err);
    return json({ error: String(err) }, 500);
  }
});
