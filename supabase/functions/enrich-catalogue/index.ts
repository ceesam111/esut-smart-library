import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Confidence = "clean_match" | "needs_review" | "no_match" | "conflict";

interface CatalogueRow {
  isbn?: string | null;
  title?: string | null;
  authors?: string[];
  publisher?: string | null;
  year?: number | null;
  subjects?: string[];
  language?: string | null;
}

interface Enrichment {
  title?: string | null;
  authors?: string[];
  publisher?: string | null;
  year?: number | null;
  subjects?: string[];
  cover_url?: string | null;
  language?: string | null;
  source?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeIsbn(value: unknown) {
  if (!value) return null;
  const isbn = String(value).replace(/[^0-9Xx]/g, "").toUpperCase();
  return isbn || null;
}

function cleanList(values: unknown[]) {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean);
}

async function lookupOpenLibrary(isbn: string): Promise<Enrichment | null> {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const item = data[`ISBN:${isbn}`];
  if (!item) return null;

  return {
    title: item.title ?? null,
    authors: cleanList((item.authors ?? []).map((author: { name?: string }) => author.name)),
    publisher: item.publishers?.[0]?.name ?? null,
    year: parseInt(String(item.publish_date ?? "").match(/\d{4}/)?.[0] ?? "", 10) || null,
    subjects: cleanList((item.subjects ?? []).slice(0, 8).map((subject: { name?: string }) => subject.name)),
    cover_url: item.cover?.medium ?? item.cover?.large ?? item.cover?.small ?? null,
    language: item.languages?.[0]?.name ?? null,
    source: "open_library",
  };
}

async function lookupGoogleBooks(isbn: string): Promise<Enrichment | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;

  return {
    title: info.title ?? null,
    authors: cleanList(info.authors ?? []),
    publisher: info.publisher ?? null,
    year: parseInt(String(info.publishedDate ?? "").match(/\d{4}/)?.[0] ?? "", 10) || null,
    subjects: cleanList(info.categories ?? []),
    cover_url: info.imageLinks?.thumbnail?.replace("http:", "https:") ?? null,
    language: info.language ?? null,
    source: "google_books",
  };
}

function confidence(row: CatalogueRow, enrichment: Enrichment | null): Confidence {
  if (!enrichment) return "no_match";
  const conflict =
    (!!row.title && !!enrichment.title && row.title.toLowerCase() !== enrichment.title.toLowerCase()) ||
    (!!row.publisher && !!enrichment.publisher && row.publisher.toLowerCase() !== enrichment.publisher.toLowerCase()) ||
    (!!row.year && !!enrichment.year && row.year !== enrichment.year);
  if (conflict) return "conflict";
  if (!row.title || !row.authors?.length || !row.publisher || !row.year || !row.subjects?.length) return "needs_review";
  return "clean_match";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const row: CatalogueRow = body.row ?? body;
    const isbn = normalizeIsbn(row.isbn);
    if (!isbn) return json({ data: {}, confidence: "needs_review" });

    let data: Enrichment | null = null;
    try { data = await lookupOpenLibrary(isbn); } catch { data = null; }
    if (!data) {
      try { data = await lookupGoogleBooks(isbn); } catch { data = null; }
    }

    return json({ data: data ?? {}, confidence: confidence(row, data) });
  } catch (error) {
    console.error("enrich-catalogue error", error);
    return json({ error: "Failed to enrich catalogue row" }, 500);
  }
});
