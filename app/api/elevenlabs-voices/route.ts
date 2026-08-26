import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveTTSApiKey } from '@/lib/server/provider-config';
import { TTS_PROVIDERS } from '@/lib/audio/constants';

const log = createLogger('ElevenLabs Voices');

export const maxDuration = 30;

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, unknown>;
  fine_tuning?: { language?: string } | null;
}

/**
 * ElevenLabs Voice Library API
 * Fetches the account's voices (including user-added Arabic voices) from
 * GET /v1/voices so they can be picked per agent in MASAR.
 */
export async function POST(req: NextRequest) {
  let baseUrl: string | undefined;
  try {
    const body = await req.json();
    baseUrl =
      body.baseUrl ||
      TTS_PROVIDERS['elevenlabs-tts'].defaultBaseUrl ||
      'https://api.elevenlabs.io/v1';
    const apiKey = resolveTTSApiKey('elevenlabs-tts', body.apiKey);

    if (!apiKey) {
      return apiError('MISSING_API_KEY', 400, 'API Key is required');
    }

    // Validate baseUrl against SSRF
    if (!baseUrl) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Base URL is required');
    }
    const ssrfError = await validateUrlForSSRF(baseUrl);
    if (ssrfError) {
      return apiError('INVALID_URL', 403, ssrfError);
    }

    // Call the ElevenLabs voice list endpoint; disable redirect following to
    // prevent SSRF via redirect.
    const response = await fetch(`${baseUrl}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      return apiError('REDIRECT_NOT_ALLOWED', 403, 'Redirects are not allowed');
    }

    if (!response.ok) {
      const errorText = await response.text();
      return apiError(
        'UPSTREAM_ERROR',
        response.status,
        'Failed to fetch voices from ElevenLabs',
        errorText || response.statusText,
      );
    }

    const data = (await response.json()) as { voices?: ElevenLabsVoice[] };
    const voices = (data.voices || []).map((voice) => {
      const labels = voice.labels || {};
      const pickLabel = (key: string) =>
        typeof labels[key] === 'string' ? (labels[key] as string) : undefined;
      return {
        id: voice.voice_id,
        name: voice.name || voice.voice_id,
        language: pickLabel('language') || voice.fine_tuning?.language || '',
        gender: pickLabel('gender'),
        description: pickLabel('description'),
      };
    });

    return apiSuccess({ voices });
  } catch (error) {
    log.error(`ElevenLabs voices fetch failed [baseUrl="${baseUrl ?? 'unknown'}"]:`, error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to fetch voices',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
