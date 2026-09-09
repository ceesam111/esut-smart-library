import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Legacy compatibility function. Active ebook search uses Next.js
// /api/search/resources so source controls, review staging, and legal-download
// policy stay centralized.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export interface EbookResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  subject: string;
  source: string;
  sourceTag: string;
  cover_url: string | null;
  read_url: string | null;
  download_url: string | null;
}

async function searchGutenberg(query: string): Promise<EbookResult[]> {
  try {
    const res = await fetch(
      `https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 6).map((b: any) => {
      const htmlUrl   = b.formats?.["text/html"] ?? null;
      const pdfUrl    = b.formats?.["application/pdf"] ?? null;
      const epubUrl   = b.formats?.["application/epub+zip"] ?? null;
      const readUrl   = htmlUrl ?? `https://www.gutenberg.org/ebooks/${b.id}`;
      const dlUrl     = epubUrl ?? pdfUrl ?? null;
      return {
        id: `gutenberg-${b.id}`,
        title: b.title ?? "Unknown",
        authors: (b.authors ?? []).map((a: any) => a.name).join("; "),
        year: null,
        subject: (b.subjects ?? []).slice(0, 3).join(", "),
        source: "gutenberg",
        sourceTag: "Project Gutenberg",
        cover_url: b.formats?.["image/jpeg"] ?? null,
        read_url: readUrl,
        download_url: dlUrl,
      };
    });
  } catch { return []; }
}

async function searchOpenLibrary(query: string): Promise<EbookResult[]> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&limit=6&fields=key,title,author_name,first_publish_year,cover_i,subject`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).filter((b: any) => b.title).slice(0, 6).map((b: any) => ({
      id: `openlibrary-${b.key?.replace("/works/", "") ?? Math.random().toString(36).slice(2)}`,
      title: b.title ?? "Unknown",
      authors: (b.author_name ?? []).slice(0, 3).join("; "),
      year: b.first_publish_year ?? null,
      subject: (b.subject ?? []).slice(0, 3).join(", "),
      source: "openlibrary",
      sourceTag: "Open Library",
      cover_url: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
      read_url: `https://openlibrary.org${b.key}`,
      download_url: null,
    }));
  } catch { return []; }
}

async function searchOAPEN(query: string): Promise<EbookResult[]> {
  try {
    const res = await fetch(
      `https://library.oapen.org/rest/search?query=${encodeURIComponent(query)}&expand=metadata&offset=0&limit=6`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.slice(0, 6).map((b: any) => {
      const metaArr: any[] = b.metadata ?? [];
      const get = (key: string) => metaArr.find((m: any) => m.key === key)?.value ?? null;
      const title = get("dc.title") ?? b.name ?? "Unknown";
      const authors = get("dc.contributor.author") ?? "";
      const year = parseInt(get("dc.date.issued") ?? "") || null;
      const uri = get("dc.identifier.uri") ?? get("dc.identifier") ?? null;
      const doi = get("dc.identifier.doi") ?? null;
      const readUrl = doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : (uri ?? null);
      return {
        id: `oapen-${b.uuid ?? b.id ?? Math.random().toString(36).slice(2)}`,
        title,
        authors,
        year,
        subject: get("dc.subject") ?? "",
        source: "oapen",
        sourceTag: "OAPEN",
        cover_url: null,
        read_url: readUrl,
        download_url: uri ?? readUrl,
      };
    });
  } catch { return []; }
}

async function searchDOAB(query: string): Promise<EbookResult[]> {
  try {
    const res = await fetch(
      `https://directory.doabooks.org/rest/search?query=${encodeURIComponent(query)}&expand=metadata&limit=6`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.slice(0, 6).map((b: any) => {
      const metaArr: any[] = b.metadata ?? [];
      const get = (key: string) => metaArr.find((m: any) => m.key === key)?.value ?? null;
      const title = get("dc.title") ?? b.name ?? "Unknown";
      const authors = get("dc.contributor.author") ?? "";
      const year = parseInt(get("dc.date.issued") ?? "") || null;
      const doi = get("dc.identifier.doi") ?? null;
      const readUrl = doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : null;
      return {
        id: `doab-${b.uuid ?? b.id ?? Math.random().toString(36).slice(2)}`,
        title,
        authors,
        year,
        subject: get("dc.subject") ?? "",
        source: "doab",
        sourceTag: "DOAB",
        cover_url: null,
        read_url: readUrl,
        download_url: readUrl,
      };
    });
  } catch { return []; }
}

async function searchGoogleBooks(query: string): Promise<EbookResult[]> {
  const GOOGLE_BOOKS_KEY = Deno.env.get("GOOGLE_BOOKS_KEY") ?? "";
  try {
    const keyParam = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : "";
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&filter=free-ebooks&maxResults=6&fields=items(id,volumeInfo,accessInfo)${keyParam}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? [])
      .filter((b: any) => b.accessInfo?.viewability === "ALL_PAGES" || b.accessInfo?.viewability === "PARTIAL")
      .slice(0, 6)
      .map((b: any) => ({
        id: `gbooks-${b.id}`,
        title: b.volumeInfo?.title ?? "Unknown",
        authors: (b.volumeInfo?.authors ?? []).join("; "),
        year: parseInt(b.volumeInfo?.publishedDate ?? "") || null,
        subject: (b.volumeInfo?.categories ?? []).join(", "),
        source: "google",
        sourceTag: "Google Books",
        cover_url: b.volumeInfo?.imageLinks?.thumbnail?.replace("http:", "https:") ?? null,
        read_url: b.accessInfo?.webReaderLink ?? b.volumeInfo?.canonicalVolumeLink ?? null,
        download_url: b.accessInfo?.pdf?.downloadLink ?? b.accessInfo?.epub?.downloadLink ?? null,
      }));
  } catch { return []; }
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

    const [gutenberg, openlibrary, oapen, doab, google] = await Promise.all([
      searchGutenberg(query),
      searchOpenLibrary(query),
      searchOAPEN(query),
      searchDOAB(query),
      searchGoogleBooks(query),
    ]);

    const all = [...gutenberg, ...openlibrary, ...oapen, ...doab, ...google];

    return json({ gutenberg, openlibrary, oapen, doab, google, all });
  } catch (err) {
    console.error("ebook-search error:", err);
    return json({ error: String(err) }, 500);
  }
});
