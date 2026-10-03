import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { MarcRecord } from './marcValidation';

export interface OverlayRule {
  id: string;
  name: string;
  framework_id: string | null;
  tag: string;
  subfield_code: string | null;
  action: 'replace' | 'preserve' | 'append' | 'protect';
  is_active: boolean;
}

export interface OverlayPreview {
  tag: string;
  subfield: string;
  currentValue: string;
  incomingValue: string;
  action: 'replace' | 'preserve' | 'append' | 'protect';
}

export async function listOverlayRules(): Promise<OverlayRule[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_overlay_rules').select('*').order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createOverlayRule(input: {
  name: string;
  framework_id?: string;
  tag: string;
  subfield_code?: string;
  action: 'replace' | 'preserve' | 'append' | 'protect';
}): Promise<OverlayRule> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from('marc_overlay_rules').insert(input).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOverlayRule(id: string, input: Partial<{
  name: string;
  action: 'replace' | 'preserve' | 'append' | 'protect';
  is_active: boolean;
}>): Promise<OverlayRule> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('marc_overlay_rules')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export function generateOverlayPreview(current: MarcRecord, incoming: MarcRecord, rules: OverlayRule[]): OverlayPreview[] {
  const previews: OverlayPreview[] = [];
  const activeRules = rules.filter(r => r.is_active);

  for (const incField of incoming.fields) {
    const rule = activeRules.find(r => {
      if (r.subfield_code) {
        return incField.tag.startsWith(r.tag) && incField.subfields?.some(s => s.code === r.subfield_code);
      }
      return incField.tag.startsWith(r.tag);
    });
    const action = rule?.action ?? 'replace';

    const curField = current.fields.find(f => f.tag === incField.tag);
    const curValue = curField?.subfields?.find(s => s.code === incField.subfields?.[0]?.code)?.value ?? '';
    const incValue = incField.subfields?.[0]?.value ?? '';

    if (action === 'protect' && curValue) {
      previews.push({ tag: incField.tag, subfield: incField.subfields?.[0]?.code ?? '', currentValue: curValue, incomingValue: incValue, action: 'protect' });
    } else if (action === 'preserve' && curValue) {
      previews.push({ tag: incField.tag, subfield: incField.subfields?.[0]?.code ?? '', currentValue: curValue, incomingValue: incValue, action: 'preserve' });
    } else if (action === 'append' && curValue) {
      previews.push({ tag: incField.tag, subfield: incField.subfields?.[0]?.code ?? '', currentValue: curValue, incomingValue: `${curValue}; ${incValue}`, action: 'append' });
    } else {
      previews.push({ tag: incField.tag, subfield: incField.subfields?.[0]?.code ?? '', currentValue: curValue, incomingValue: incValue, action: 'replace' });
    }
  }

  return previews;
}

export async function applyOverlay(
  targetRecordId: string,
  incoming: MarcRecord,
  rules: OverlayRule[],
  performedBy?: string,
): Promise<{ fieldsChanged: string[]; fieldsPreserved: string[] }> {
  const supabase = getSupabaseAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from('catalogue_items')
    .select('marc21_fields, marc21_leader')
    .eq('id', targetRecordId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const current = target.marc21_fields as MarcRecord | null;
  if (!current) throw new Error('Target record has no MARC data');

  const activeRules = rules.filter(r => r.is_active);
  const fieldsChanged: string[] = [];
  const fieldsPreserved: string[] = [];

  const newFields = [...current.fields];

  for (const incField of incoming.fields) {
    const rule = activeRules.find(r => {
      if (r.subfield_code) {
        return incField.tag.startsWith(r.tag) && incField.subfields?.some(s => s.code === r.subfield_code);
      }
      return incField.tag.startsWith(r.tag);
    });
    const action = rule?.action ?? 'replace';

    if (action === 'protect') {
      fieldsPreserved.push(`${incField.tag}$${incField.subfields?.[0]?.code ?? ''}`);
      continue;
    }

    const idx = newFields.findIndex(f => f.tag === incField.tag);
    if (action === 'preserve' && idx >= 0) {
      fieldsPreserved.push(`${incField.tag}$${incField.subfields?.[0]?.code ?? ''}`);
      continue;
    }

    if (action === 'append' && idx >= 0) {
      const existing = newFields[idx];
      const mergedSubfields = [...(existing.subfields ?? [])];
      for (const sf of incField.subfields ?? []) {
        const existingSf = mergedSubfields.find(s => s.code === sf.code);
        if (existingSf) {
          existingSf.value = `${existingSf.value}; ${sf.value}`;
        } else {
          mergedSubfields.push(sf);
        }
      }
      newFields[idx] = { ...existing, subfields: mergedSubfields };
      fieldsChanged.push(`${incField.tag}$${incField.subfields?.[0]?.code ?? ''}`);
      continue;
    }

    if (idx >= 0) {
      newFields[idx] = incField;
    } else {
      newFields.push(incField);
    }
    fieldsChanged.push(`${incField.tag}$${incField.subfields?.[0]?.code ?? ''}`);
  }

  const { error: updateError } = await supabase
    .from('catalogue_items')
    .update({ marc21_fields: { leader: incoming.leader, fields: newFields } as unknown as Record<string, unknown>, marc21_leader: incoming.leader })
    .eq('id', targetRecordId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from('marc_overlay_audit').insert({
    target_record_id: targetRecordId,
    fields_changed: fieldsChanged,
    fields_preserved: fieldsPreserved,
    performed_by: performedBy ?? null,
  });

  return { fieldsChanged, fieldsPreserved };
}
