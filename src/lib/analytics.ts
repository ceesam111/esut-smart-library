export interface ClientEventPayload {
  event_type: string;
  entity_id: string;
  entity_type?: string;
  search_query?: string;
  provider?: string;
  path?: string;
  result_count?: number;
  metadata?: Record<string, unknown>;
}

export async function trackClientEvent(payload: ClientEventPayload): Promise<void> {
  try {
    await fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // analytics must never break the user experience
  }
}
