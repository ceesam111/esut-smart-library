import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/requireRole';
import { GLOBAL_ADMIN_ROLES } from '@/server/auth/permissions';
import { getAiProviderHealth, providerOrder, resolveProviders } from '@/server/ai/providerRouter';

export const dynamic = 'force-dynamic';

/**
 * Non-secret AI provider status for administrators:
 * configured/not-configured, free-tier flag, circuit-breaker state and the
 * last success/failure reason. Never returns API keys or model secrets.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole(request, GLOBAL_ADMIN_ROLES);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: message === 'Forbidden.' ? 403 : 401 });
  }

  return NextResponse.json({
    order: providerOrder(),
    providers: resolveProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
      local: provider.local,
      freeTier: provider.freeTier,
      baseUrl: provider.baseUrl ? new URL(provider.baseUrl).host : null,
    })),
    health: getAiProviderHealth(),
  });
}
