import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ZENODO_TOKEN = Deno.env.get("ZENODO_TOKEN");
const ZENODO_BASE = "https://zenodo.org/api";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { item_id } = await req.json();
    if (!item_id) {
      return new Response(JSON.stringify({ error: "item_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ZENODO_TOKEN) {
      return new Response(JSON.stringify({ error: "ZENODO_TOKEN not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: item, error: fetchErr } = await supabase
      .from("repository_items")
      .select("*")
      .eq("id", item_id)
      .single();

    if (fetchErr || !item) {
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authors = Array.isArray(item.authors) ? item.authors : [];
    const creators = authors.map((a: any) => ({
      name: typeof a === "string" ? a : (a.name ?? "Unknown"),
      ...(a.orcid ? { orcid: a.orcid } : {}),
    }));
    if (creators.length === 0) creators.push({ name: "ESUT Repository" });

    // Step 1 — Create deposit
    const depositRes = await fetch(`${ZENODO_BASE}/deposit/depositions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZENODO_TOKEN}`,
      },
      body: JSON.stringify({
        metadata: {
          title: item.title,
          creators,
          description: item.abstract ?? item.title,
          upload_type: "publication",
          publication_type: "article",
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          access_right: "open",
          license: "cc-by",
        },
      }),
    });

    if (!depositRes.ok) {
      const err = await depositRes.text();
      return new Response(JSON.stringify({ error: "Zenodo deposit failed", detail: err }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deposit = await depositRes.json();
    const depositionId = deposit.id;
    const bucketUrl = deposit.links?.bucket;

    // Step 2 — Upload file (if available)
    if (item.file_url && bucketUrl) {
      const fileRes = await fetch(item.file_url);
      if (fileRes.ok) {
        const fileBlob = await fileRes.blob();
        const fileName = item.file_url.split("/").pop() ?? `${item_id}.pdf`;
        await fetch(`${bucketUrl}/${fileName}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${ZENODO_TOKEN}` },
          body: fileBlob,
        });
      }
    }

    // Step 3 — Publish
    const publishRes = await fetch(
      `${ZENODO_BASE}/deposit/depositions/${depositionId}/actions/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ZENODO_TOKEN}` },
      },
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      return new Response(JSON.stringify({ error: "Zenodo publish failed", detail: err }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const published = await publishRes.json();
    const doi = published.doi ?? published.metadata?.doi;

    // Step 4 — Save DOI and set status to published
    await supabase.from("repository_items").update({
      doi,
      zenodo_id: String(depositionId),
      status: "published",
      updated_at: new Date().toISOString(),
    }).eq("id", item_id);

    // Record version 1
    await supabase.from("item_versions").insert({
      item_id,
      version_number: 1,
      file_url: item.file_url,
      change_note: "Initial publication",
    });

    return new Response(JSON.stringify({ ok: true, doi, zenodo_id: depositionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("zenodo-publish error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
