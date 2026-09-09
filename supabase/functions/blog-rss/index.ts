import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, author, published_date, created_at, category, content")
    .eq("status", "published")
    .order("published_date", { ascending: false })
    .limit(20);

  const siteUrl = "https://library.esut.edu.ng";
  const now = new Date().toUTCString();

  const items = (posts ?? []).map((p: any) => {
    const pubDate = p.published_date
      ? new Date(p.published_date).toUTCString()
      : new Date(p.created_at).toUTCString();
    const desc = p.excerpt || (p.content ? p.content.replace(/<[^>]+>/g, "").slice(0, 200) + "…" : "");
    return `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${siteUrl}/blog/${p.slug}</link>
      <guid isPermaLink="true">${siteUrl}/blog/${p.slug}</guid>
      <description><![CDATA[${desc}]]></description>
      <author>${p.author || "ESUT Library"}</author>
      <category>${p.category || ""}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
  }).join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ESUT Library Blog</title>
    <link>${siteUrl}/blog</link>
    <description>News, research insights and updates from ESUT Library</description>
    <language>en-ng</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteUrl}/functions/v1/blog-rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
