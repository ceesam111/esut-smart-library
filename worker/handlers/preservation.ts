import { createHash } from 'crypto';
import type { AgentJobHandler } from '../types';
import { requireTenant, safeResult } from './utils';
import { getSupabaseAdminClient } from '../../src/server/supabase/adminClient';

export const verifyFixity: AgentJobHandler = async (job, { supabase }) => {
  requireTenant(job);
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: files, error } = await supabaseAdmin
    .from('repository_files')
    .select('id, storage_bucket, storage_key, checksum, checksum_algorithm, preservation_status, next_verification_at')
    .lte('next_verification_at', new Date().toISOString())
    .limit(10);

  if (error) throw new Error(error.message);
  if (!files?.length) return safeResult('No files due for verification.', { verified: 0 });

  let verified = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const { data: objectData, error: downloadError } = await supabaseAdmin.storage
        .from(file.storage_bucket)
        .download(file.storage_key);

      if (downloadError || !objectData) {
        await supabaseAdmin.from('repository_files').update({
          preservation_status: 'MISSING',
          last_verification_result: 'MISSING',
          last_verified_at: new Date().toISOString(),
        }).eq('id', file.id);
        await supabaseAdmin.from('preservation_incidents').insert({
          repository_file_id: file.id,
          incident_type: 'MISSING',
          expected_checksum: file.checksum,
          status: 'open',
        });
        failed++;
        continue;
      }

      const bytes = Buffer.from(await objectData.arrayBuffer());
      const observed = createHash('sha256').update(bytes).digest('hex');

      if (observed === file.checksum) {
        await supabaseAdmin.from('repository_files').update({
          preservation_status: 'VALID',
          last_verification_result: 'VALID',
          last_verified_at: new Date().toISOString(),
          next_verification_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).eq('id', file.id);
        await supabaseAdmin.from('preservation_events').insert({
          repository_file_id: file.id,
          event_type: 'FIXITY_VERIFIED',
          details: { result: 'VALID' },
        });
        verified++;
      } else {
        await supabaseAdmin.from('repository_files').update({
          preservation_status: 'MISMATCH',
          last_verification_result: 'MISMATCH',
          last_verified_at: new Date().toISOString(),
          observed_checksum: observed,
        }).eq('id', file.id);
        await supabaseAdmin.from('preservation_incidents').insert({
          repository_file_id: file.id,
          incident_type: 'MISMATCH',
          expected_checksum: file.checksum,
          observed_checksum: observed,
          status: 'open',
        });
        failed++;
      }
    } catch (err) {
      await supabaseAdmin.from('repository_files').update({
        preservation_status: 'ERROR',
        last_verification_result: 'ERROR',
        last_verified_at: new Date().toISOString(),
      }).eq('id', file.id);
      failed++;
    }
  }

  return safeResult('Fixity verification completed.', { verified, failed, total: files.length });
};
