import { getSupabaseAdminClient } from '@/server/supabase/adminClient';
import { noticeDeliveryService } from './deliveryService';
import { getPatronNoticeProfile } from './patronNotice';
import type { NoticeContext, NoticeType } from './notices';

const WORKFLOW_ACTION_NOTICE: Record<string, NoticeType> = {
  submit: 'submission_received',
  resubmit: 'submission_received',
  approve: 'approved',
  reject: 'rejected',
  return_for_correction: 'returned_for_correction',
  request_changes: 'changes_requested',
  publish: 'published',
};

export const WORKFLOW_NOTICE_TYPES = WORKFLOW_ACTION_NOTICE;

interface WorkflowNoticeInput {
  instanceId: string;
  action: string;
  actorId: string;
  comment?: string;
}

async function resolveTitle(instance: {
  repository_item_id?: string | null;
  thesis_id?: string | null;
}): Promise<string> {
  const supabase = getSupabaseAdminClient();
  try {
    if (instance.repository_item_id) {
      const { data } = await supabase
        .from('repository_items')
        .select('title')
        .eq('id', instance.repository_item_id)
        .maybeSingle();
      if (data?.title) return String(data.title);
    }
    if (instance.thesis_id) {
      const { data } = await supabase
        .from('theses')
        .select('title')
        .eq('id', instance.thesis_id)
        .maybeSingle();
      if (data?.title) return String(data.title);
    }
  } catch {
    // Title lookup must never block a transition.
  }
  return 'Your submission';
}

/**
 * Sends the workflow notice for a transition to the submission creator
 * (in-app always when the user exists; email when the patron has one).
 * Failures are swallowed: notices must never fail a transition.
 */
export async function dispatchWorkflowNotice(input: WorkflowNoticeInput): Promise<void> {
  const noticeType = WORKFLOW_ACTION_NOTICE[input.action];
  if (!noticeType) return;

  try {
    const supabase = getSupabaseAdminClient();
    const { data: instance } = await supabase
      .from('workflow_instances')
      .select('id, repository_item_id, thesis_id, created_by, current_state, status')
      .eq('id', input.instanceId)
      .maybeSingle();
    if (!instance?.created_by) return;

    const title = await resolveTitle(instance);
    const profile = await getPatronNoticeProfile({ userId: instance.created_by });

    const context: NoticeContext = {
      patron_name: profile?.fullName ?? 'Patron',
      item_title: title,
      repository_title: title,
      submission_title: title,
      submission_status: instance.current_state ?? '',
      workflow_status: instance.current_state ?? input.action,
      rejection_feedback: input.comment ?? '',
      changes_details: input.comment ?? '',
      published_url: '',
      library_name: 'ESUT Library',
    };

    const base = {
      noticeType,
      context,
      entityType: 'workflow',
      entityId: `${input.instanceId}:${input.action}`,
    };

    await noticeDeliveryService.send({
      ...base,
      channel: 'in-app',
      userId: instance.created_by,
      idempotencyKey: `workflow:${input.instanceId}:${input.action}:in-app`,
    });

    if (profile?.email) {
      await noticeDeliveryService.send({
        ...base,
        channel: 'email',
        userId: instance.created_by,
        email: profile.email,
        idempotencyKey: `workflow:${input.instanceId}:${input.action}:email`,
      });
    }
  } catch {
    // Notices are best-effort for workflow transitions.
  }
}
