import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { NoticeType } from '@/server/circulation/notices';

export interface InAppNoticeInput {
  user_id: string;
  notice_type: NoticeType;
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

export async function createInAppNotice(input: InAppNoticeInput) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      user_id: input.user_id,
      title: input.title,
      body: input.message,
      url: input.action_url ?? '/dashboard',
      type: input.notice_type,
      is_read: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create in-app notice: ${error.message}`);
  return data;
}

/**
 * Mark a user notification as read.
 */
export async function markNoticeRead(noticeId: string, userId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('id', noticeId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to mark notice as read: ${error.message}`);
  return error === null;
}

/**
 * List user's notifications with optional filters.
 */
export async function listUserNotices(
  userId: string,
  options?: { type?: NoticeType; unreadOnly?: boolean; limit?: number }
) {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from('user_notifications').select('*').eq('user_id', userId);

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (options?.type) {
    query = query.eq('type', options.type);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list notices: ${error.message}`);
  return data ?? [];
}

/**
 * Count unread notifications for a user.
 */
export async function countUnreadNotices(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw new Error(`Failed to count unread notices: ${error.message}`);
  return count ?? 0;
}

export default { createInAppNotice, markNoticeRead, listUserNotices, countUnreadNotices };