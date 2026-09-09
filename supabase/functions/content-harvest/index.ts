import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Legacy compatibility function. Active harvest UI uses Next.js
// /api/admin/harvest and the worker resources.harvest job so source controls,
// review staging, and legal-download policy stay centralized.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAILTO = "library@esut.edu.ng";
const CORE_API_KEY = Deno.env.get("CORE_API_KEY") ?? "";

function recencyBadge(year: number | null): string {
  if (!year) return "Classic";
  const age = new Date().getFullYear() - year;
  if (age <= 5) return "Recent";
  if (age <= 15) return "Classic";
  return "Historical";
}

async function harvestOpenAlex(subject: string): Promise<any[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(subject)}&filter=publication_year:%3E2020,open_access.is_oa:true&sort=publication_year:desc&per-page=10&mailto=${MAILTO}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((w: any) => ({
      title: w.title ?? "",
      authors: (w.authorships ?? []).slice(0, 5).map((a: any) => a.author?.display_name ?? "").join("; "),
      year: w.publication_year ?? null,
      abstract: w.abstract ?? "",
      doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
      source_url: w.primary_location?.landing_page_url ?? w.primary_location?.pdf_url ?? null,
      source: "OpenAlex",
    }));
  } catch { return []; }
}

async function harvestDOAJ(subject: string): Promise<any[]> {
  try {
    const url = `https://doaj.org/api/search/articles/${encodeURIComponent(subject)}?pageSize=5&sort=publishedAt:desc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((a: any) => ({
      title: a.bibjson?.title ?? "",
      authors: (a.bibjson?.author ?? []).slice(0, 5).map((au: any) => au.name ?? "").join("; "),
      year: a.bibjson?.year ? parseInt(a.bibjson.year) : null,
      abstract: a.bibjson?.abstract ?? "",
      doi: a.bibjson?.identifier?.find((i: any) => i.type === "doi")?.id ?? null,
      source_url: a.bibjson?.link?.find((l: any) => l.type === "fulltext")?.url ?? null,
      source: "DOAJ",
    }));
  } catch { return []; }
}

async function harvestCORE(subject: string): Promise<any[]> {
  if (!CORE_API_KEY) return [];
  try {
    const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(subject + " education")}&limit=5&sort=_score`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${CORE_API_KEY}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((w: any) => ({
      title: w.title ?? "",
      authors: (w.authors ?? []).slice(0, 5).map((a: any) => a.name ?? "").join("; "),
      year: w.yearPublished ?? null,
      abstract: w.abstract ?? "",
      doi: w.doi ?? null,
      source_url: w.downloadUrl ?? w.sourceFulltextUrls?.[0] ?? null,
      source: "CORE",
    }));
  } catch { return []; }
}

async function harvestGutenberg(subject: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://gutendex.com/books/?search=${encodeURIComponent(subject)}&languages=en,yo&mime_type=text/html`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 5).map((b: any) => ({
      title: b.title ?? "",
      authors: (b.authors ?? []).map((a: any) => a.name).join("; "),
      year: b.copyright_year ?? null,
      abstract: (b.subjects ?? []).slice(0, 6).join(", "),
      doi: null,
      source_url: b.formats?.["text/html"] ?? b.formats?.["application/epub+zip"] ?? null,
      source: "Project Gutenberg",
      item_type: "ebook",
    }));
  } catch { return []; }
}

async function harvestOpenLibrary(subject: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(subject)}&has_fulltext=true&fields=key,title,author_name,first_publish_year,subject,cover_i&limit=5`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).slice(0, 5).map((b: any) => ({
      title: b.title ?? "",
      authors: (b.author_name ?? []).slice(0, 3).join("; "),
      year: b.first_publish_year ?? null,
      abstract: (b.subject ?? []).slice(0, 5).join(", "),
      doi: null,
      source_url: `https://openlibrary.org${b.key}`,
      source: "Open Library",
      item_type: "ebook",
    }));
  } catch { return []; }
}

async function harvestOAPEN(subject: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://library.oapen.org/rest/search?query=${encodeURIComponent(subject)}&expand=metadata&offset=0&limit=5`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.slice(0, 5).map((b: any) => {
      const meta = (b.metadata ?? []).reduce((acc: any, m: any) => { acc[m.key] = m.value; return acc; }, {});
      const doi = meta["dc.identifier.doi"] ?? meta["dc.identifier"] ?? null;
      return {
        title: meta["dc.title"] ?? b.name ?? "",
        authors: meta["dc.contributor.author"] ?? "",
        year: parseInt(meta["dc.date.issued"] ?? "") || null,
        abstract: meta["dc.description.abstract"] ?? meta["dc.description"] ?? "",
        doi: doi ? doi.replace(/^https?:\/\/doi\.org\//, "") : null,
        source_url: meta["dc.identifier.uri"] ?? (doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : null),
        source: "OAPEN",
        item_type: "ebook",
      };
    });
  } catch { return []; }
}

async function harvestDOAB(subject: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://directory.doabooks.org/rest/search?query=${encodeURIComponent(subject)}&expand=metadata&limit=5`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    return items.slice(0, 5).map((b: any) => {
      const meta = (b.metadata ?? []).reduce((acc: any, m: any) => { acc[m.key] = m.value; return acc; }, {});
      const doi = meta["dc.identifier.doi"] ?? null;
      return {
        title: meta["dc.title"] ?? b.name ?? "",
        authors: meta["dc.contributor.author"] ?? "",
        year: parseInt(meta["dc.date.issued"] ?? "") || null,
        abstract: meta["dc.description.abstract"] ?? meta["dc.description"] ?? "",
        doi: doi ? doi.replace(/^https?:\/\/doi\.org\//, "") : null,
        source_url: doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}` : null,
        source: "DOAB",
        item_type: "ebook",
      };
    });
  } catch { return []; }
}

async function upsertItem(supabase: any, item: any, subject: string, logEntry: any) {
  // Deduplicate by DOI first, then by title
  let existing: any = null;

  if (item.doi) {
    const { data } = await supabase
      .from("catalogue_items")
      .select("id")
      .eq("isbn", item.doi)
      .maybeSingle();
    existing = data;
  }

  if (!existing && item.title) {
    const { data } = await supabase
      .from("catalogue_items")
      .select("id")
      .ilike("title", item.title.slice(0, 100))
      .maybeSingle();
    existing = data;
  }

  if (existing) {
    logEntry.items_skipped++;
    return;
  }

  const { error } = await supabase.from("catalogue_items").insert({
    title: item.title,
    authors: item.authors || null,
    publication_year: item.year || null,
    abstract: item.abstract || null,
    isbn: item.doi || null,
    source_url: item.source_url || null,
    item_type: item.item_type ?? "article",
    access_type: "Online — Open Access",
    visibility: "Global",
    is_harvested: true,
    harvest_source: item.source,
    recency_badge: recencyBadge(item.year),
    subject_area: subject,
    status: "available",
  });

  if (!error) logEntry.items_added++;
  else logEntry.items_skipped++;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load enabled subjects from config
    const { data: configs } = await supabase
      .from("content_engine_config")
      .select("subject, enabled")
      .eq("enabled", true);

    const subjects = (configs ?? []).map((c: any) => c.subject);
    if (!subjects.length) return json({ ok: true, message: "No subjects enabled" });

    const summary: any[] = [];

    for (const subject of subjects) {
      // Run all harvest sources in parallel per subject
      const [openAlexItems, doajItems, coreItems, gutenbergItems, openLibraryItems, oapenItems, doabItems] = await Promise.all([
        harvestOpenAlex(subject),
        harvestDOAJ(subject),
        harvestCORE(subject),
        harvestGutenberg(subject),
        harvestOpenLibrary(subject),
        harvestOAPEN(subject),
        harvestDOAB(subject),
      ]);

      for (const [source, items] of [
        ["OpenAlex", openAlexItems],
        ["DOAJ", doajItems],
        ["CORE", coreItems],
        ["Project Gutenberg", gutenbergItems],
        ["Open Library", openLibraryItems],
        ["OAPEN", oapenItems],
        ["DOAB", doabItems],
      ] as [string, any[]][]) {
        const logEntry = {
          subject,
          source,
          items_found: items.length,
          items_added: 0,
          items_skipped: 0,
          status: "ok",
          error_message: null as string | null,
        };

        try {
          for (const item of items) {
            if (!item.title?.trim()) { logEntry.items_skipped++; continue; }
            await upsertItem(supabase, item, subject, logEntry);
          }
        } catch (err: any) {
          logEntry.status = "error";
          logEntry.error_message = String(err);
        }

        await supabase.from("harvest_log").insert(logEntry);
        summary.push(logEntry);
      }
    }

    const totalAdded = summary.reduce((s, e) => s + e.items_added, 0);
    return json({ ok: true, subjects: subjects.length, total_added: totalAdded, log: summary });
  } catch (err) {
    console.error("content-harvest error:", err);
    return json({ error: String(err) }, 500);
  }
});
