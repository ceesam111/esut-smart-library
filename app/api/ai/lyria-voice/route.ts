import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_LYRIA_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel, a clear female voice.

function mapElevenLabsStatus(status: number) {
  if (status === 402) return { status: 200, code: 'VOICE_PAYMENT_REQUIRED' };
  if (status === 401 || status === 403) return { status: 503, code: 'VOICE_AUTH_FAILED' };
  if (status === 404) return { status: 503, code: 'VOICE_NOT_FOUND' };
  if (status === 422) return { status: 503, code: 'VOICE_REQUEST_REJECTED' };
  if (status === 429) return { status: 200, code: 'VOICE_QUOTA_EXCEEDED' };
  return { status: 502, code: 'VOICE_UPSTREAM_FAILED' };
}

async function summarizeElevenLabsError(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return undefined;
  return text.replace(/\s+/g, ' ').slice(0, 300);
}

function generateVoice(key: string, voiceId: string, text: string, modelId?: string) {
  const payload: Record<string, unknown> = { text: text.slice(0, 4500) };
  if (modelId) payload.model_id = modelId;

  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(payload),
  });
}

function isPaidLibraryVoiceError(status: number, error?: string) {
  return status === 402 && Boolean(error?.includes('paid_plan_required') || error?.toLowerCase().includes('library voices'));
}

function fallbackVoice(error: string) {
  return NextResponse.json({ fallback: true, error });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'Text is required.' }, { status: 400 });

    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return fallbackVoice('VOICE_NOT_CONFIGURED');

    const configuredVoiceId = process.env.ELEVENLABS_LYRIA_VOICE_ID;
    let voiceId = configuredVoiceId || DEFAULT_LYRIA_VOICE_ID;
    let modelId = process.env.ELEVENLABS_MODEL_ID || undefined;
    let response = await generateVoice(key, voiceId, text, modelId);

    if (response.status === 402 && modelId) {
      await response.body?.cancel().catch(() => undefined);
      modelId = undefined;
      response = await generateVoice(key, voiceId, text);
    }

    if (!response.ok) {
      let upstreamError = await summarizeElevenLabsError(response);

      if (configuredVoiceId && voiceId !== DEFAULT_LYRIA_VOICE_ID && isPaidLibraryVoiceError(response.status, upstreamError)) {
        voiceId = DEFAULT_LYRIA_VOICE_ID;
        modelId = undefined;
        response = await generateVoice(key, voiceId, text);
        if (response.ok) {
          return new Response(response.body, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'no-store',
            },
          });
        }
        upstreamError = await summarizeElevenLabsError(response);
      }

      if (isPaidLibraryVoiceError(response.status, upstreamError)) return fallbackVoice('VOICE_REQUIRES_PREMADE_VOICE');

      const mapped = mapElevenLabsStatus(response.status);
      console.error('Lexis voice generation failed', {
        code: mapped.code,
        upstreamStatus: response.status,
        voiceIdConfigured: Boolean(configuredVoiceId),
        usedDefaultVoice: voiceId === DEFAULT_LYRIA_VOICE_ID,
        modelId,
        upstreamError,
      });
      return NextResponse.json({ fallback: true, error: mapped.code }, { status: mapped.status });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Voice unavailable.' }, { status: 500 });
  }
}
