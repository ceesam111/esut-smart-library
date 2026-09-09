import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE_URL = "https://library.esut.edu.ng/api/oai";
const REPO_NAME = "ESUT Digital Repository";
const ADMIN_EMAIL = "library@esut.edu.ng";
const PAGE_SIZE = 100;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function oaiIdentifier(id: string): string {
  return `oai:library.esut.edu.ng:${id}`;
}

function datestamp(iso: string): string {
  return iso.substring(0, 10);
}

function dcRecord(item: any): string {
  const authors = Array.isArray(item.authors) ? item.authors : [];
  const subjects = Array.isArray(item.subjects) ? item.subjects : [];
  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  const doi = item.doi ? `https://doi.org/${item.doi}` : null;
  const itemUrl = `https://library.esut.edu.ng/repository/${item.id}`;

  const creatorTags = authors
    .map((a: any) => `<dc:creator>${xmlEscape(typeof a === "string" ? a : (a.name ?? ""))}</dc:creator>`)
    .join("\n        ");

  const subjectTags = [...subjects, ...keywords]
    .map((s: string) => `<dc:subject>${xmlEscape(s)}</dc:subject>`)
    .join("\n        ");

  const identifierTags = [
    `<dc:identifier>${xmlEscape(itemUrl)}</dc:identifier>`,
    doi ? `<dc:identifier>${xmlEscape(doi)}</dc:identifier>` : "",
  ].filter(Boolean).join("\n        ");

  return `<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"
          xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
        <dc:title>${xmlEscape(item.title ?? "")}</dc:title>
        ${creatorTags}
        ${subjectTags}
        <dc:description>${xmlEscape(item.abstract ?? "")}</dc:description>
        <dc:date>${item.year ?? ""}</dc:date>
        <dc:type>${xmlEscape(item.item_type ?? item.type ?? "")}</dc:type>
        ${identifierTags}
        <dc:language>${xmlEscape(item.language ?? "English")}</dc:language>
        <dc:rights>CC BY 4.0 https://creativecommons.org/licenses/by/4.0/</dc:rights>
      </oai_dc:dc>`;
}

function oaiEnvelope(verb: string, body: string, params = ""): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd">
  <responseDate>${now}</responseDate>
  <request verb="${verb}" ${params}>${BASE_URL}</request>
  ${body}
</OAI-PMH>`;
}

function oaiError(code: string, msg: string, verb = ""): string {
  return oaiEnvelope(verb, `<error code="${code}">${xmlEscape(msg)}</error>`);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const p = url.searchParams;
  const verb = p.get("verb") ?? "";
  const metadataPrefix = p.get("metadataPrefix") ?? "";
  const from = p.get("from") ?? "";
  const until = p.get("until") ?? "";
  const identifier = p.get("identifier") ?? "";
  const set = p.get("set") ?? "";
  const resumptionToken = p.get("resumptionToken") ?? "";

  const xml = (body: string): Response =>
    new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "text/xml; charset=UTF-8" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Identify
  if (verb === "Identify") {
    const { data: earliest } = await supabase
      .from("repository_items")
      .select("created_at")
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const earliestDate = earliest ? datestamp(earliest.created_at) : "2020-01-01";

    return xml(oaiEnvelope("Identify", `<Identify>
    <repositoryName>${xmlEscape(REPO_NAME)}</repositoryName>
    <baseURL>${BASE_URL}</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>${ADMIN_EMAIL}</adminEmail>
    <earliestDatestamp>${earliestDate}</earliestDatestamp>
    <deletedRecord>no</deletedRecord>
    <granularity>YYYY-MM-DD</granularity>
  </Identify>`));
  }

  // ListMetadataFormats
  if (verb === "ListMetadataFormats") {
    return xml(oaiEnvelope("ListMetadataFormats", `<ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
    <metadataFormat>
      <metadataPrefix>oai_marc</metadataPrefix>
      <schema>http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd</schema>
      <metadataNamespace>http://www.loc.gov/MARC21/slim</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>`));
  }

  // ListSets
  if (verb === "ListSets") {
    const { data: communities } = await supabase
      .from("repository_communities")
      .select("slug, name")
      .order("name");

    const sets = (communities ?? [])
      .map((c: any) => `<set>
      <setSpec>${xmlEscape(c.slug)}</setSpec>
      <setName>${xmlEscape(c.name)}</setName>
    </set>`)
      .join("\n    ");

    return xml(oaiEnvelope("ListSets", `<ListSets>${sets}</ListSets>`));
  }

  // GetRecord
  if (verb === "GetRecord") {
    if (metadataPrefix !== "oai_dc" && metadataPrefix !== "oai_marc") {
      return xml(oaiError("cannotDisseminateFormat", "Unsupported metadataPrefix", verb));
    }
    if (!identifier) {
      return xml(oaiError("badArgument", "identifier is required", verb));
    }
    const itemId = identifier.replace("oai:library.esut.edu.ng:", "");
    const { data: item } = await supabase
      .from("repository_items")
      .select("*")
      .eq("id", itemId)
      .eq("status", "published")
      .maybeSingle();

    if (!item) {
      return xml(oaiError("idDoesNotExist", "Record not found", verb));
    }

    return xml(oaiEnvelope("GetRecord", `<GetRecord>
    <record>
      <header>
        <identifier>${oaiIdentifier(item.id)}</identifier>
        <datestamp>${datestamp(item.updated_at)}</datestamp>
        ${item.faculty_code ? `<setSpec>${xmlEscape(item.faculty_code)}</setSpec>` : ""}
      </header>
      <metadata>
        ${dcRecord(item)}
      </metadata>
    </record>
  </GetRecord>`, `metadataPrefix="${metadataPrefix}" identifier="${xmlEscape(identifier)}"`));
  }

  // ListRecords and ListIdentifiers
  if (verb === "ListRecords" || verb === "ListIdentifiers") {
    if (!resumptionToken && metadataPrefix !== "oai_dc" && metadataPrefix !== "oai_marc") {
      return xml(oaiError("cannotDisseminateFormat", "Unsupported metadataPrefix", verb));
    }

    let offset = 0;
    let decodedPrefix = metadataPrefix;
    if (resumptionToken) {
      try {
        const decoded = JSON.parse(atob(resumptionToken));
        offset = decoded.offset ?? 0;
        decodedPrefix = decoded.prefix ?? "oai_dc";
      } catch {
        return xml(oaiError("badResumptionToken", "Invalid resumption token", verb));
      }
    }

    let query = supabase
      .from("repository_items")
      .select("*")
      .eq("status", "published")
      .eq("visibility", "global")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (from) query = query.gte("updated_at", `${from}T00:00:00Z`);
    if (until) query = query.lte("updated_at", `${until}T23:59:59Z`);
    if (set) query = query.eq("faculty_code", set);

    const { data: items, error } = await query;
    if (error) return xml(oaiError("internalError", "Database error", verb));
    if (!items || items.length === 0) {
      return xml(oaiError("noRecordsMatch", "No records match the query", verb));
    }

    const records = items.map((item: any) => {
      const header = `<header>
        <identifier>${oaiIdentifier(item.id)}</identifier>
        <datestamp>${datestamp(item.updated_at)}</datestamp>
        ${item.faculty_code ? `<setSpec>${xmlEscape(item.faculty_code)}</setSpec>` : ""}
      </header>`;

      if (verb === "ListIdentifiers") return `<header>${header}</header>`;

      return `<record>
      ${header}
      <metadata>
        ${dcRecord(item)}
      </metadata>
    </record>`;
    }).join("\n    ");

    const nextOffset = offset + items.length;
    const token = items.length === PAGE_SIZE
      ? `<resumptionToken>${btoa(JSON.stringify({ offset: nextOffset, prefix: decodedPrefix }))}</resumptionToken>`
      : "";

    const tag = verb === "ListIdentifiers" ? "ListIdentifiers" : "ListRecords";
    return xml(oaiEnvelope(verb, `<${tag}>
    ${records}
    ${token}
  </${tag}>`));
  }

  return xml(oaiError("badVerb", "Illegal OAI verb", verb));
});
