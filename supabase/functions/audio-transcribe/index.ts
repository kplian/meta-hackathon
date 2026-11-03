// Supabase Edge Function: Transcribe audio using Meta's muse-voice-transcribe-1.0 model.
// Accepts multipart/form-data or raw audio bytes (Ogg Opus / WAV), converts Ogg Opus to 16kHz WAV,
// and invokes Meta's ASR endpoint.
import {
  isWav,
  isOgg,
  convertOggOpusToWav16k,
  callMetaAsr,
  AudioTranscribeError,
} from '../_shared/audio-transcribe.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-meta-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let audioBytes: Uint8Array | null = null;
    let language = 'es';

    // 1. Extract audio bytes and optional language parameter
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') || formData.get('audio') || formData.get('data');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        audioBytes = new Uint8Array(await (file as Blob).arrayBuffer());
      }
      const langParam = formData.get('language');
      if (typeof langParam === 'string' && langParam.trim()) {
        language = langParam.trim();
      }
    } else {
      // Raw binary payload
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 0) {
        audioBytes = new Uint8Array(buffer);
      }
      const url = new URL(request.url);
      const langParam = url.searchParams.get('language');
      if (langParam) language = langParam;
    }

    if (!audioBytes || audioBytes.byteLength === 0) {
      return json({ error: 'empty_audio_payload', message: 'No audio data received.' }, 400);
    }

    // 2. Transcode to 16kHz mono WAV if received as OGG or raw Opus
    let wavBytes: Uint8Array;
    if (isWav(audioBytes)) {
      wavBytes = audioBytes;
    } else {
      // If detected as Ogg or by default for WhatsApp voice notes
      try {
        wavBytes = await convertOggOpusToWav16k(audioBytes);
      } catch (err: any) {
        console.error('Failed to decode Ogg Opus audio:', err);
        return json(
          {
            error: 'audio_decode_failed',
            message: 'Unable to decode input audio. Ensure audio is valid OGG Opus or WAV.',
            detail: err?.message,
          },
          422
        );
      }
    }

    // 3. Resolve Meta API credentials
    const metaToken =
      request.headers.get('x-meta-token') ||
      Deno.env.get('META_API_KEY') ||
      Deno.env.get('LLM_API_KEY') ||
      'LLM_1601850044361661_nWMUaAofmDRVL7K8ByCZ_J5TCRs';

    if (!metaToken) {
      return json(
        { error: 'meta_api_key_missing', message: 'Meta Model API token is not configured.' },
        500
      );
    }

    // 4. Call Meta ASR endpoint (muse-voice-transcribe-1.0)
    const result = await callMetaAsr(wavBytes, {
      metaApiKey: metaToken,
      language,
      model: 'muse-voice-transcribe-1.0',
    });

    return json({
      success: true,
      text: result.text,
      language,
      model: 'muse-voice-transcribe-1.0',
    });
  } catch (error: any) {
    if (error instanceof AudioTranscribeError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    console.error('Unexpected error during audio transcription:', error);
    return json(
      {
        error: 'transcription_failed',
        message: error?.message || 'An unexpected error occurred during transcription.',
      },
      502
    );
  }
});

