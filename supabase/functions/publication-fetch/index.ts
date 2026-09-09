import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SEMANTIC_SCHOLAR_KEY = Deno.env.get("SEMANTIC_SCHOLAR_KEY") ?? "";

interface Publication {
  title: string;
  authors: string[];
  year: number | null;
  journal_or_publisher: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  publication_type: string;
  citation_count: number;
  source: string;
  apa_formatted: string;
}

// ─── APA 7th edition formatter ─────────────────────────────────────────────

function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    .replace(/:\s+(\w)/g, (m, c) => m.replace(c, c.toUpperCase()));
}

function formatAuthorAPA(name: string): string {
  const trimmed = name.trim();
  // Already in "Last, F. I." format
  if (trimmed.includes(",")) return trimmed;
  // "First Middle Last" format
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(" ");
  return `${last}, ${initials}`;
}

function formatAuthorsAPA(authors: string[]): string {
  if (!authors.length) return "Unknown author.";
  const formatted = authors.slice(0, 20).map(formatAuthorAPA);
  if (authors.length > 20) {
    return `${formatted.slice(0, 19).join(", ")}, ... ${formatAuthorAPA(authors[authors.length - 1])}`;
  }
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

function buildAPA(pub: Partial<Publication> & { title: string }): string {
  const authors = formatAuthorsAPA(pub.authors ?? []);
  const year = pub.year ? `(${pub.year})` : "(n.d.)";
  const title = toSentenceCase(pub.title);

  switch (pub.publication_type) {
    case "journal": {
      let cit = `${authors} ${year}. ${title}. *${pub.journal_or_publisher ?? ""}*`;
      if (pub.volume) cit += `, *${pub.volume}*`;
      if (pub.issue) cit += `(${pub.issue})`;
      if (pub.pages) cit += `, ${pub.pages}`;
      cit += ".";
      if (pub.doi) cit += ` https://doi.org/${pub.doi}`;
      return cit;
    }
    case "book":
      return `${authors} ${year}. *${title}*. ${pub.journal_or_publisher ?? ""}.`;
    case "chapter":
      return `${authors} ${year}. ${title}. In *${pub.journal_or_publisher ?? ""}*.`;
    case "conference":
      return `${authors} ${year}. ${title}. [Conference presentation]. ${pub.journal_or_publisher ?? ""}.`;
    default: {
      let cit = `${authors} ${year}. ${title}. ${pub.journal_or_publisher ?? ""}`;
      if (pub.volume) cit += `, ${pub.volume}`;
      if (pub.issue) cit += `(${pub.issue})`;
      if (pub.pages) cit += `, ${pub.pages}`;
      cit += ".";
      if (pub.doi) cit += ` https://doi.org/${pub.doi}`;
      return cit;
    }
  }
}

// ─── Detect publication type from ORCID type string ────────────────────────

function mapOrcidType(orcidType: string): string {
  const t = (orcidType ?? "").toLowerCase();
  if (t.includes("journal") || t.includes("article")) return "journal";
  if (t.includes("book-chapter") || t.includes("chapter")) return "chapter";
  if (t.includes("book")) return "book";
  if (t.includes("conference") || t.includes("proceedings")) return "conference";
  return "other";
}

// ─── Fetch from ORCID ───────────────────────────────────────────────────────

async function fetchOrcidWorks(orcid: string): Promise<Partial<Publication>[]> {
  const res = await fetch(`https://pub.orcid.org/v3.0/${orcid}/works`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = await res.json();

  const groups: Partial<Publication>[] = [];
  for (const group of (data.group ?? [])) {
    const summary = group["work-summary"]?.[0];
    if (!summary) continue;

    const title = summary.title?.title?.value ?? "";
    const year = summary["publication-date"]?.year?.value
      ? parseInt(summary["publication-date"].year.value)
      : null;
    const journal = summary["journal-title"]?.value ?? "";
    const orcidType = summary.type ?? "";
    let doi = "";
    for (const eid of (summary["external-ids"]?.["external-id"] ?? [])) {
      if (eid["external-id-type"] === "doi") {
        doi = eid["external-id-value"] ?? "";
        break;
      }
    }

    groups.push({
      title,
      authors: [],
      year,
      journal_or_publisher: journal,
      doi,
      publication_type: mapOrcidType(orcidType),
      volume: "",
      issue: "",
      pages: "",
      citation_count: 0,
      source: "orcid",
    });
  }
  return groups;
}

// ─── Enrich via Crossref ─────────────────────────────────────────────────────

async function enrichCrossref(doi: string): Promise<Partial<Publication>> {
  if (!doi) return {};
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: {
        "User-Agent": "ESUT-Library/1.0 (mailto:library@esut.edu.ng)",
      },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const work = data.message;
    const authors = (work.author ?? []).map((a: { family?: string; given?: string }) =>
      [a.family, a.given].filter(Boolean).join(", ")
    );
    const volume = work.volume ?? "";
    const issue = work.issue ?? "";
    const pages = work.page ?? "";
    const citations = work["is-referenced-by-count"] ?? 0;
    const journal = (work["container-title"]?.[0]) ?? (work.publisher ?? "");
    const year = work.issued?.["date-parts"]?.[0]?.[0] ?? null;

    return { authors, volume, issue, pages, citation_count: citations, journal_or_publisher: journal, year };
  } catch {
    return {};
  }
}

// ─── Fetch from Semantic Scholar ─────────────────────────────────────────────

async function fetchSemanticScholar(firstName: string, surname: string): Promise<{
  publications: Partial<Publication>[];
  hIndex: number | null;
  totalCitations: number | null;
  authorId: string | null;
}> {
  const headers: Record<string, string> = {};
  if (SEMANTIC_SCHOLAR_KEY) headers["x-api-key"] = SEMANTIC_SCHOLAR_KEY;

  try {
    const searchUrl = `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(`${firstName} ${surname}`)}&fields=papers.title,papers.year,papers.externalIds,papers.citationCount,papers.journal,papers.authors`;
    const res = await fetch(searchUrl, { headers });
    if (!res.ok) return { publications: [], hIndex: null, totalCitations: null, authorId: null };
    const data = await res.json();

    const firstAuthor = data.data?.[0];
    if (!firstAuthor) return { publications: [], hIndex: null, totalCitations: null, authorId: null };

    const authorId = firstAuthor.authorId;

    // Fetch author metrics
    let hIndex: number | null = null;
    let totalCitations: number | null = null;
    if (authorId) {
      const metricRes = await fetch(
        `https://api.semanticscholar.org/graph/v1/author/${authorId}?fields=hIndex,citationCount`,
        { headers }
      );
      if (metricRes.ok) {
        const metrics = await metricRes.json();
        hIndex = metrics.hIndex ?? null;
        totalCitations = metrics.citationCount ?? null;
      }
    }

    const publications: Partial<Publication>[] = (firstAuthor.papers ?? []).map((paper: {
      title: string;
      year: number;
      externalIds: Record<string, string>;
      citationCount: number;
      journal: { name: string } | null;
      authors: Array<{ name: string }>;
    }) => ({
      title: paper.title ?? "",
      authors: (paper.authors ?? []).map((a) => a.name),
      year: paper.year ?? null,
      doi: paper.externalIds?.DOI ?? "",
      journal_or_publisher: paper.journal?.name ?? "",
      citation_count: paper.citationCount ?? 0,
      publication_type: "journal",
      source: "semantic_scholar",
      volume: "",
      issue: "",
      pages: "",
    }));

    return { publications, hIndex, totalCitations, authorId };
  } catch {
    return { publications: [], hIndex: null, totalCitations: null, authorId: null };
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

function mergePubs(lists: Partial<Publication>[][]): Partial<Publication>[] {
  const seen = new Map<string, Partial<Publication>>();

  for (const list of lists) {
    for (const pub of list) {
      const key = pub.doi ? `doi:${pub.doi.toLowerCase()}` : `title:${normTitle(pub.title ?? "")}`;
      if (!seen.has(key)) {
        seen.set(key, { ...pub });
      } else {
        const existing = seen.get(key)!;
        // Merge: prefer Crossref authors, take max citation count
        if (pub.authors?.length && !existing.authors?.length) existing.authors = pub.authors;
        if ((pub.citation_count ?? 0) > (existing.citation_count ?? 0)) {
          existing.citation_count = pub.citation_count;
        }
        if (pub.volume && !existing.volume) existing.volume = pub.volume;
        if (pub.issue && !existing.issue) existing.issue = pub.issue;
        if (pub.pages && !existing.pages) existing.pages = pub.pages;
        if (pub.journal_or_publisher && !existing.journal_or_publisher) {
          existing.journal_or_publisher = pub.journal_or_publisher;
        }
        if (pub.year && !existing.year) existing.year = pub.year;
      }
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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
    const { action, orcid, first_name, surname } = await req.json();

    if (action === "verify_orcid") {
      if (!orcid) return json({ error: "Missing orcid" }, 400);

      const res = await fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return json({ valid: false, error: "ORCID not found" });

      const data = await res.json();
      const name = [
        data.person?.name?.["given-names"]?.value,
        data.person?.name?.["family-name"]?.value,
      ].filter(Boolean).join(" ");

      return json({ valid: true, name });
    }

    if (action === "fetch_publications") {
      if (!orcid && !first_name) {
        return json({ error: "orcid or first_name+surname required" }, 400);
      }

      const allLists: Partial<Publication>[][] = [];

      // ORCID works
      if (orcid) {
        const orcidPubs = await fetchOrcidWorks(orcid);
        // Enrich each with Crossref
        const enriched: Partial<Publication>[] = [];
        for (const pub of orcidPubs) {
          const extra = pub.doi ? await enrichCrossref(pub.doi) : {};
          enriched.push({ ...pub, ...extra, source: pub.doi ? "crossref" : "orcid" });
        }
        allLists.push(enriched);
      }

      // Semantic Scholar
      let hIndex: number | null = null;
      let totalCitations: number | null = null;
      if (first_name && surname) {
        const ss = await fetchSemanticScholar(first_name, surname);
        allLists.push(ss.publications);
        hIndex = ss.hIndex;
        totalCitations = ss.totalCitations;
      }

      const merged = mergePubs(allLists);

      // Add APA formatting
      const publications = merged.map((pub) => ({
        ...pub,
        apa_formatted: buildAPA(pub as Publication & { title: string }),
      }));

      return json({ publications, h_index: hIndex, total_citations: totalCitations });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("publication-fetch error:", err);
    return json({ error: String(err) }, 500);
  }
});
