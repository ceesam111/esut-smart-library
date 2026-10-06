import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface KbartSerial {
  title: string;
  print_issn?: string;
  online_issn?: string;
  publisher?: string;
  start_year?: string;
  end_year?: string;
  frequency?: string;
  url?: string;
  subject?: string;
}

export const KBART_COLUMNS = [
  'publication_title',
  'print_identifier',
  'online_identifier',
  'publisher',
  'start_year',
  'end_year',
  'frequency',
  'url',
  'subject',
] as const;

function kbartField(value: string | undefined): string {
  return (value || '').replace(/[\t\r\n]+/g, ' ').trim();
}

export function generateKbart(serials: KbartSerial[]): string {
  const header = [...KBART_COLUMNS].join('\t');

  const rows = serials
    .filter((s) => kbartField(s.title).length > 0)
    .map((s) =>
      [
        kbartField(s.title),
        kbartField(s.print_issn),
        kbartField(s.online_issn),
        kbartField(s.publisher),
        kbartField(s.start_year),
        kbartField(s.end_year),
        kbartField(s.frequency),
        kbartField(s.url),
        kbartField(s.subject),
      ].join('\t'),
    );

  return [header, ...rows].join('\n');
}

export async function getSerialsForKbart(): Promise<KbartSerial[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('serials_subscriptions')
    .select('title, issn, eissn, publisher, start_date, end_date, frequency, url, subjects')
    .limit(500);
  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    title: s.title || '',
    print_issn: s.issn || undefined,
    online_issn: s.eissn || undefined,
    publisher: s.publisher || undefined,
    start_year: s.start_date?.slice(0, 4) || undefined,
    end_year: s.end_date?.slice(0, 4) || undefined,
    frequency: s.frequency || undefined,
    url: s.url || undefined,
    subject: Array.isArray(s.subjects) ? s.subjects.join('; ') : undefined,
  }));
}
