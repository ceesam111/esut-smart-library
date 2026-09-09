import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

const parser = new Parser({
  customFields: {
    item: ['author', 'category'],
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const serialId = body.serialId as string | undefined;

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('newspaper_serials')
      .select('id, name, rss_url, article_count')
      .not('rss_url', 'is', null)
      .eq('is_active', true);

    if (serialId) {
      query = query.eq('id', serialId);
    }

    const { data: serials, error: serialsError } = await query;

    if (serialsError) {
      return NextResponse.json({ success: false, error: serialsError.message }, { status: 500 });
    }

    if (!serials || serials.length === 0) {
      return NextResponse.json({ success: false, error: 'No active RSS feeds found' }, { status: 404 });
    }

    let totalAdded = 0;
    let feedsProcessed = 0;
    const runDate = new Date().toISOString();

    for (const serial of serials) {
      if (!serial.rss_url) continue;

      let found = 0;
      let added = 0;
      let skipped = 0;
      let status = 'ok';
      let errorMessage = null;

      try {
        const feed = await parser.parseURL(serial.rss_url);
        found = feed.items.length;

        for (const item of feed.items) {
          const guid = item.guid || item.link || `${serial.id}:${item.title}`;
          const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
          
          const { error: insertError } = await supabase.from('newspaper_articles').insert({
            serial_id: serial.id,
            title: item.title?.slice(0, 500) || 'Untitled',
            link: item.link || null,
            author: item.creator || item.author || null,
            published_at: publishedAt,
            summary: (item.contentSnippet || item.content || item.summary || '').slice(0, 1000) || null,
            subjects: item.categories || [],
            guid: guid.slice(0, 255),
            indexing_status: 'automatic',
            indexed_at: new Date().toISOString(),
          });

          if (insertError) {
            // usually duplicate key error for guid, we skip
            if (insertError.code === '23505') {
              skipped++;
            } else {
              throw new Error(insertError.message);
            }
          } else {
            added++;
          }
        }
        
        await supabase.from('newspaper_serials').update({
          last_harvested_at: runDate,
          article_count: (serial.article_count || 0) + added
        }).eq('id', serial.id);

      } catch (err) {
        status = 'error';
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      await supabase.from('harvest_log').insert({
        run_date: runDate,
        subject: serial.name,
        source: 'newspaper-rss',
        items_found: found,
        items_added: added,
        items_skipped: skipped,
        status,
        error_message: errorMessage,
      });

      totalAdded += added;
      feedsProcessed++;
    }

    return NextResponse.json({ success: true, totalAdded, feeds: feedsProcessed });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
