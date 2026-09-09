import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_ID = "singleton";

interface DoabBook {
  id: string;
  title: string;
  authors: string;
  publisher: string;
  year: number | null;
  subject: string;
  cover_url: string | null;
  record_url: string;
}

const MIN_YEAR = 2020;
// directory.doab.org currently serves an expired TLS certificate, so we use the
// legacy DSpace 6 REST API host (directory.doabooks.org) which mirrors DOAB.
const FILTER_BASE = "https://directory.doabooks.org/rest/filtered-items";

function getAllFor(metadata: any[]) {
  return (key: string) =>
    metadata.filter((m) => m?.key === key && m?.value).map((m) => m.value as string);
}

function normaliseOne(obj: any): DoabBook | null {
  const metadata: any[] = obj?.metadata ?? [];
  const getAll = getAllFor(metadata);
  const get = (key: string) => getAll(key)[0] ?? null;

  // Books only — exclude chapters / book parts.
  const types = getAll("dc.type").map((t) => t.toLowerCase().trim());
  if (types.length && !types.some((t) => t === "book")) return null;

  const title = get("dc.title") ?? obj?.name ?? null;
  if (!title) return null;

  const year = parseInt(get("dc.date.issued") ?? "", 10) || null;
  if (!year || year < MIN_YEAR) return null;

  const authors =
    [
      ...getAll("dc.contributor.author"),
      ...getAll("dc.creator"),
      ...getAll("dc.contributor.editor"),
    ]
      .slice(0, 4)
      .join("; ") || "Unknown author";

  const publisher = get("publisher.name") ?? get("dc.publisher") ?? "";

  const subject =
    [
      ...getAll("dc.subject.classification"),
      ...getAll("dc.subject.other"),
      ...getAll("dc.subject"),
    ]
      .slice(0, 3)
      .join(", ") || "General";

  const isbnRaw =
    get("dc.identifier.isbn") ??
    getAll("dc.identifier").find((v) => /\d{9,13}/.test(v.replace(/[^0-9Xx]/g, ""))) ??
    null;
  const isbn = isbnRaw ? isbnRaw.replace(/[^0-9Xx]/g, "") : null;
  const cover_url =
    isbn && (isbn.length === 10 || isbn.length === 13)
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`
      : null;

  const handle = obj?.handle ?? null;
  const record_url = handle
    ? `https://directory.doabooks.org/handle/${handle}`
    : get("dc.identifier.uri") ?? "https://www.doabooks.org";

  return {
    id: `doab-${handle ?? obj?.uuid ?? Math.random().toString(36).slice(2)}`,
    title,
    authors,
    publisher,
    year,
    subject,
    cover_url,
    record_url,
  };
}

async function fetchPage(offset: number, limit: number): Promise<any[]> {
  const params = new URLSearchParams();
  params.append("query_field[]", "dc.date.issued");
  params.append("query_op[]", "matches");
  params.append("query_val[]", "^202[0-9]");
  params.append("query_field[]", "dc.type");
  params.append("query_op[]", "equals");
  params.append("query_val[]", "book");
  params.set("expand", "metadata");
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const res = await fetch(`${FILTER_BASE}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(35000),
  });
  if (!res.ok) throw new Error(`DOAB ${res.status}`);
  const data = await res.json();
  return data?.items ?? (Array.isArray(data) ? data : []);
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const force = new URL(req.url).searchParams.get("refresh") === "1";

  // 1. Serve fresh cache instantly.
  try {
    const { data: cached } = await admin
      .from("doab_books_cache")
      .select("payload, updated_at")
      .eq("id", CACHE_ID)
      .maybeSingle();
    if (!force && cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
      return json({ ...cached.payload, cached: true });
    }

    // 2. Refresh from DOAB.
    const limit = 20;
    const maxPages = 4;
    const raw: any[] = [];
    let errors = 0;
    for (let p = 0; p < maxPages; p++) {
      let items: any[] = [];
      try {
        items = await fetchPage(p * limit, limit);
      } catch (_e) {
        if (++errors >= 3) break;
        continue;
      }
      raw.push(...items);
      if (items.length === 0) break;
    }

    const seen = new Set<string>();
    const books = raw
      .map(normaliseOne)
      .filter((b): b is DoabBook => b !== null)
      .filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

    // If DOAB returned nothing but we have stale cache, keep serving it.
    if (books.length === 0 && cached) {
      return json({ ...cached.payload, cached: true, stale: true });
    }

    const subjects = [
      ...new Set(
        books.flatMap((b) => b.subject.split(",").map((s) => s.trim()).filter(Boolean)),
      ),
    ]
      .sort()
      .slice(0, 60);

    const payload = { ok: true, count: books.length, books: books.slice(0, 240), subjects };

    await admin
      .from("doab_books_cache")
      .upsert({ id: CACHE_ID, payload, updated_at: new Date().toISOString() });

    return json(payload);
  } catch (err) {
    console.error("doab-books error:", err);
    return json({ ok: false, error: String(err), books: [], subjects: [] }, 200);
  }
});

