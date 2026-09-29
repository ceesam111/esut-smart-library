import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { withHandler } from '@/server/api/withHandler';

const illRequestSchema = z.object({
  title: z.string().min(1).max(500),
  author: z.string().max(200).optional(),
  publisher: z.string().max(200).optional(),
  year: z.number().int().min(1800).max(2100).optional(),
  isbn: z.string().max(20).optional(),
  issn: z.string().max(20).optional(),
  doi: z.string().max(200).optional(),
  url: z.string().url().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  urgency: z.enum(['normal', 'urgent']).default('normal'),
});

export const POST = withHandler({
  bodySchema: illRequestSchema,
  handler: async ({ request, body }) => {
    const ctx = await requireUser(request);
    const supabase = getSupabaseAdminClient();
    const b = body as z.infer<typeof illRequestSchema>;

    const { data: patron } = await supabase
      .from('patrons')
      .select('id')
      .eq('user_id', ctx.user.id)
      .maybeSingle();

    if (!patron) {
      return NextResponse.json({ error: 'Patron account not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('ill_requests')
      .insert({
        patron_id: patron.id,
        title: b.title,
        author: b.author || null,
        publisher: b.publisher || null,
        year: b.year || null,
        isbn: b.isbn || null,
        issn: b.issn || null,
        doi: b.doi || null,
        url: b.url || null,
        notes: b.notes || null,
        urgency: b.urgency,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  },
});
