import { z } from 'zod';
import { requireRole } from '@/server/auth/requireRole';
import { LIBRARY_ADMIN_ROLES } from '@/server/auth/permissions';
import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { withHandler } from '@/server/api/withHandler';

const barcodeSchema = z.object({ code: z.string().min(1).max(128) });

export const POST = withHandler({
  bodySchema: barcodeSchema,
  handler: async ({ request, body }) => {
    const parsed = body as z.infer<typeof barcodeSchema>;
    await requireRole(request, LIBRARY_ADMIN_ROLES);
    const supabase = getSupabaseAdminClient();
    const value = parsed.code.trim();

    if (value.startsWith('PAT-')) {
      const { data, error } = await supabase.from('patrons').select('id, full_name, email, library_number, patron_id').or(`library_number.eq.${value},patron_id.eq.${value}`).maybeSingle();
      if (error) throw new Error(error.message);
      return { data: { type: 'patron', record: data, href: data ? `/admin/patrons` : null } };
    }
    if (value.startsWith('COPY-')) {
      const { data, error } = await supabase.from('catalogue_copies').select('*, catalogue_items(title,isbn)').eq('barcode', value).maybeSingle();
      if (error) throw new Error(error.message);
      return { data: { type: 'copy', record: data, href: data?.item_id ? `/catalogue/${data.item_id}` : null } };
    }
    if (value.startsWith('THS-')) {
      const id = value.replace(/^THS-/, '');
      const { data, error } = await supabase.from('repository_items').select('id,title,status').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return { data: { type: 'thesis', record: data, href: data ? `/repository/${data.id}` : null } };
    }
    if (value.startsWith('SHF-')) {
      const shelf = value.replace(/^SHF-/, '');
      const { data, error } = await supabase.from('library_shelves').select('*').eq('shelf_code', shelf).maybeSingle();
      if (error) throw new Error(error.message);
      return { data: { type: 'shelf', record: data, href: null } };
    }

    return { data: { type: 'unknown', record: null, href: null } };
  },
});
