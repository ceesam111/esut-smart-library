import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface EdiOrderSegment {
  segment: string;
  elements: string[];
}
export async function generateEdi850Async(poId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: poData } = await supabase
    .from('purchase_orders')
    .select('*, acquisition_suppliers(name, email), purchase_order_items(*)')
    .eq('id', poId)
    .maybeSingle();

  if (!poData) throw new Error('Purchase order not found');

  const po: Record<string, unknown> = poData as Record<string, unknown>;
  const items: Array<Record<string, unknown>> = (poData.purchase_order_items as Array<Record<string, unknown>>) ?? [];
  const supplier: Record<string, unknown> | null = poData.acquisition_suppliers as Record<string, unknown> | null;
  void po;
  void supplier;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const time = new Date().toTimeString().slice(0, 4).replace(/:/g, '');
  const controlNum = poId.slice(0, 8);

  const segments: string[] = [
    `ISA*00*          *00*          *ZZ*ESUTLIBRARY   *ZZ*SUPPLIER       *${today}*${time}*U*00401*000000001*0*T*>~`,
    `GS*PO*ESUTLIB*SUPPLIER*${today}*${time}*1*X*004010~`,
    `ST*850*0001~`,
    `BEG*00*SA*${controlNum}**${today}~`,
    `CUR*SE*~`,
    `N1*BY*ESUT Library~`,
    `N3*Enugu State University~`,
    `N4*Enugu*NG*540001~`,
  ];

  for (const item of items) {
    const qty = String(item.quantity || 0);
    const price = String(item.unit_price || 0);
    const bp = String(item.isbn || item.title || 'ITEM').slice(0, 20);
    segments.push(`PO1*${qty}*EA*${price}**BP*${bp}~`);
  }

  segments.push(`CTT*${items.length}~`);
  segments.push(`SE*${segments.length + 1}*0001~`);
  segments.push(`GE*1*1~`);
  segments.push(`IEA*1*000000001~`);

  return segments.join('\n');
}
