import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import type { MarcRecord, MarcField } from './marcValidation';

export type BatchOperationType = 'ADD_FIELD' | 'DELETE_FIELD' | 'REPLACE_FIELD' | 'ADD_SUBFIELD' | 'DELETE_SUBFIELD' | 'REPLACE_SUBFIELD';

export interface BatchOperation {
  type: BatchOperationType;
  tag: string;
  subfield?: string;
  newTag?: string;
  newSubfield?: string;
  newValue?: string;
  newInd1?: string;
  newInd2?: string;
}

export interface BatchModificationPreview {
  recordId: string;
  title: string;
  operations: Array<{
    operation: BatchOperation;
    before: string;
    after: string;
    status: 'ok' | 'warning' | 'error';
    message?: string;
  }>;
}

export interface BatchModificationResult {
  recordId: string;
  success: boolean;
  changes: string[];
  errors: string[];
}

export function previewBatchModification(record: MarcRecord, operations: BatchOperation[]): BatchModificationPreview['operations'] {
  const results: BatchModificationPreview['operations'] = [];

  for (const op of operations) {
    const field = record.fields.find(f => f.tag === op.tag);

    switch (op.type) {
      case 'ADD_FIELD':
        if (field) {
          results.push({ operation: op, before: fieldToString(field), after: fieldToString(field), status: 'warning', message: 'Field already exists' });
        } else {
          const newField: MarcField = { tag: op.newTag ?? op.tag, ind1: op.newInd1 ?? ' ', ind2: op.newInd2 ?? ' ', subfields: op.newSubfield ? [{ code: op.newSubfield, value: op.newValue ?? '' }] : [] };
          results.push({ operation: op, before: '(none)', after: fieldToString(newField), status: 'ok' });
        }
        break;
      case 'DELETE_FIELD':
        if (!field) {
          results.push({ operation: op, before: '(none)', after: '(none)', status: 'error', message: 'Field not found' });
        } else {
          results.push({ operation: op, before: fieldToString(field), after: '(deleted)', status: 'ok' });
        }
        break;
      case 'REPLACE_FIELD':
        if (!field) {
          results.push({ operation: op, before: '(none)', after: '(none)', status: 'error', message: 'Field not found' });
        } else {
          const newField: MarcField = { tag: op.newTag ?? field.tag, ind1: op.newInd1 ?? field.ind1, ind2: op.newInd2 ?? field.ind2, subfields: op.newSubfield ? [{ code: op.newSubfield, value: op.newValue ?? '' }] : field.subfields };
          results.push({ operation: op, before: fieldToString(field), after: fieldToString(newField), status: 'ok' });
        }
        break;
      case 'ADD_SUBFIELD':
        if (!field) {
          results.push({ operation: op, before: '(none)', after: '(none)', status: 'error', message: 'Field not found' });
        } else {
          const newSubs = [...(field.subfields ?? []), { code: op.newSubfield ?? op.subfield ?? 'a', value: op.newValue ?? '' }];
          results.push({ operation: op, before: fieldToString(field), after: fieldToString({ ...field, subfields: newSubs }), status: 'ok' });
        }
        break;
      case 'DELETE_SUBFIELD':
        if (!field || !field.subfields?.find(s => s.code === op.subfield)) {
          results.push({ operation: op, before: '(none)', after: '(none)', status: 'error', message: 'Subfield not found' });
        } else {
          const newSubs = field.subfields.filter(s => s.code !== op.subfield);
          results.push({ operation: op, before: fieldToString(field), after: fieldToString({ ...field, subfields: newSubs }), status: 'ok' });
        }
        break;
      case 'REPLACE_SUBFIELD':
        if (!field || !field.subfields?.find(s => s.code === op.subfield)) {
          results.push({ operation: op, before: '(none)', after: '(none)', status: 'error', message: 'Subfield not found' });
        } else {
          const newSubs = field.subfields.map(s => s.code === op.subfield ? { ...s, value: op.newValue ?? s.value } : s);
          results.push({ operation: op, before: fieldToString(field), after: fieldToString({ ...field, subfields: newSubs }), status: 'ok' });
        }
        break;
    }
  }

  return results;
}

export async function applyBatchModification(
  recordIds: string[],
  operations: BatchOperation[],
  _performedBy?: string,
): Promise<BatchModificationResult[]> {
  const supabase = getSupabaseAdminClient();
  const results: BatchModificationResult[] = [];

  for (const recordId of recordIds) {
    const { data: record, error: fetchError } = await supabase
      .from('catalogue_items')
      .select('marc21_fields, marc21_leader, title')
      .eq('id', recordId)
      .single();
    if (fetchError) {
      results.push({ recordId, success: false, changes: [], errors: [fetchError.message] });
      continue;
    }

    const marc = record.marc21_fields as MarcRecord | null;
    if (!marc) {
      results.push({ recordId, success: false, changes: [], errors: ['No MARC data'] });
      continue;
    }

    const changes: string[] = [];
    const errors: string[] = [];
    const newFields = [...marc.fields];

    for (const op of operations) {
      const idx = newFields.findIndex(f => f.tag === op.tag);
      const field = idx >= 0 ? newFields[idx] : null;

      try {
        switch (op.type) {
          case 'ADD_FIELD':
            if (!field) {
              newFields.push({ tag: op.newTag ?? op.tag, ind1: op.newInd1 ?? ' ', ind2: op.newInd2 ?? ' ', subfields: op.newSubfield ? [{ code: op.newSubfield, value: op.newValue ?? '' }] : [] });
              changes.push(`Added ${op.newTag ?? op.tag}`);
            }
            break;
          case 'DELETE_FIELD':
            if (idx >= 0) {
              newFields.splice(idx, 1);
              changes.push(`Deleted ${op.tag}`);
            }
            break;
          case 'REPLACE_FIELD':
            if (idx >= 0 && newFields[idx]) {
              const existing = newFields[idx];
              newFields[idx] = { tag: op.newTag ?? existing.tag, ind1: op.newInd1 ?? existing.ind1, ind2: op.newInd2 ?? existing.ind2, subfields: op.newSubfield ? [{ code: op.newSubfield, value: op.newValue ?? '' }] : existing.subfields };
              changes.push(`Replaced ${op.tag}`);
            }
            break;
          case 'ADD_SUBFIELD':
            if (idx >= 0) {
              const existing = newFields[idx];
              existing.subfields = [...(existing.subfields ?? []), { code: op.newSubfield ?? op.subfield ?? 'a', value: op.newValue ?? '' }];
              changes.push(`Added subfield to ${op.tag}`);
            }
            break;
          case 'DELETE_SUBFIELD':
            if (idx >= 0 && newFields[idx].subfields) {
              newFields[idx].subfields = newFields[idx].subfields!.filter(s => s.code !== op.subfield);
              changes.push(`Deleted subfield from ${op.tag}`);
            }
            break;
          case 'REPLACE_SUBFIELD':
            if (idx >= 0 && newFields[idx].subfields) {
              newFields[idx].subfields = newFields[idx].subfields!.map(s => s.code === op.subfield ? { ...s, value: op.newValue ?? s.value } : s);
              changes.push(`Replaced subfield in ${op.tag}`);
            }
            break;
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    if (changes.length > 0 && errors.length === 0) {
      const { error: updateError } = await supabase
        .from('catalogue_items')
        .update({ marc21_fields: { leader: marc.leader, fields: newFields } as unknown as Record<string, unknown>, marc21_leader: marc.leader })
        .eq('id', recordId);
      if (updateError) {
        errors.push(updateError.message);
      }
    }

    results.push({ recordId, success: errors.length === 0, changes, errors });
  }

  return results;
}

function fieldToString(field: MarcField): string {
  if (field.value !== undefined) return field.value;
  const subs = (field.subfields ?? []).map(s => `$${s.code}${s.value}`).join('');
  return `${field.tag} ${field.ind1 ?? ' '}${field.ind2 ?? ' '} ${subs}`;
}
