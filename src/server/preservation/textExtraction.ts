import { getSupabaseAdminClient } from '@/server/supabase/adminClient';

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  confidence?: number;
}

export async function extractText(file: Buffer, mimeType: string): Promise<ExtractionResult | null> {
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'application/json') {
    return { text: file.toString('utf-8') };
  }

  return null;
}

export async function extractFileText(fileId: string): Promise<{ success: boolean; text?: string; error?: string }> {
  const supabase = getSupabaseAdminClient();

  const { data: file, error } = await supabase
    .from('repository_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle();

  if (error || !file) return { success: false, error: 'File not found' };

  await supabase.from('repository_files').update({ extracted_text_status: 'PROCESSING' }).eq('id', fileId);

  try {
    const { data: objectData, error: downloadError } = await supabase.storage
      .from(file.storage_bucket)
      .download(file.storage_key);

    if (downloadError || !objectData) {
      await supabase.from('repository_files').update({ extracted_text_status: 'FAILED' }).eq('id', fileId);
      return { success: false, error: 'Download failed' };
    }

    const bytes = Buffer.from(await objectData.arrayBuffer());
    const result = await extractText(bytes, file.mime_type || 'application/octet-stream');

    if (!result) {
      await supabase.from('repository_files').update({ extracted_text_status: 'NOT_SUPPORTED' }).eq('id', fileId);
      return { success: false, error: 'File type not supported' };
    }

    await supabase.from('repository_files').update({
      extracted_text_status: 'COMPLETE',
      extracted_text: result.text.slice(0, 100000),
    }).eq('id', fileId);

    return { success: true, text: result.text };
  } catch (err) {
    await supabase.from('repository_files').update({ extracted_text_status: 'FAILED' }).eq('id', fileId);
    return { success: false, error: err instanceof Error ? err.message : 'Extraction failed' };
  }
}
