// Supabase Edge Function: Journal AI Parser (Text, Voice Audio, Receipt Photo)
// Utilizes Meta's muse-voice-transcribe-1.0 (ASR) and muse-spark-1.3 (LLM & Vision) models.

import {
  isWav,
  convertOggOpusToWav16k,
  callMetaAsr,
} from '../_shared/audio-transcribe.ts';

import {
  buildSystemPrompt,
  parseJournalAiResponse,
  callMetaLlm,
  JournalAiError,
  type JournalAiCategory,
} from '../_shared/journal-ai.ts';

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
    return json({ success: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const metaToken =
      request.headers.get('x-meta-token') ||
      Deno.env.get('META_API_KEY') ||
      Deno.env.get('LLM_API_KEY') ||
      'LLM_1601850044361661_nWMUaAofmDRVL7K8ByCZ_J5TCRs';

    let actionType: 'text' | 'audio' | 'photo' = 'text';
    let textInput = '';
    let audioBytes: Uint8Array | null = null;
    let imageUrl = '';
    let currency = 'BOB';
    let categories: JournalAiCategory[] = [];

    // Parse input from multipart/form-data or application/json
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      actionType = (formData.get('type') as any) || 'text';
      textInput = (formData.get('text') as string) || '';
      currency = (formData.get('currency') as string) || 'BOB';

      const catsRaw = formData.get('categories');
      if (typeof catsRaw === 'string') {
        try {
          categories = JSON.parse(catsRaw);
        } catch {
          // Ignore invalid JSON in categories
        }
      }

      const file = formData.get('file') || formData.get('audio') || formData.get('image');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const buf = await (file as Blob).arrayBuffer();
        if (actionType === 'audio') {
          audioBytes = new Uint8Array(buf);
        } else if (actionType === 'photo') {
          const mime = (file as Blob).type || 'image/jpeg';
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          imageUrl = `data:${mime};base64,${b64}`;
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      actionType = body.type || 'text';
      textInput = body.text || '';
      currency = body.currency || 'BOB';
      if (Array.isArray(body.categories)) {
        categories = body.categories;
      }

      if (body.audio) {
        // Base64 audio string
        const cleanB64 = body.audio.replace(/^data:[^;]+;base64,/, '');
        const binary = atob(cleanB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        audioBytes = bytes;
      }

      if (body.image) {
        if (body.image.startsWith('data:')) {
          imageUrl = body.image;
        } else {
          imageUrl = `data:image/jpeg;base64,${body.image}`;
        }
      }
    }

    // Default categories fallback if empty
    if (!categories.length) {
      categories = [
        { key: 'supermarket_groceries', name: 'Supermercado y Alimentos' },
        { key: 'dining_out', name: 'Restaurantes y Salidas' },
        { key: 'fuel_transport', name: 'Transporte y Combustible' },
        { key: 'pharmacy_health', name: 'Farmacia y Salud' },
        { key: 'utilities', name: 'Servicios Básicos' },
        { key: 'education', name: 'Educación' },
        { key: 'housing', name: 'Vivienda y Alquiler' },
        { key: 'general', name: 'Gastos Generales' },
      ];
    }

    const systemPrompt = buildSystemPrompt(currency, categories);

    // 1. Process Text Input
    if (actionType === 'text') {
      if (!textInput.trim()) {
        return json({ success: false, error: 'empty_text_input', message: 'No text provided.' }, 400);
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textInput.trim() },
      ];

      const completion = await callMetaLlm(messages, { metaApiKey: metaToken });
      const result = parseJournalAiResponse(completion, categories);

      return json({ success: true, data: result });
    }

    // 2. Process Audio Recording
    if (actionType === 'audio') {
      if (!audioBytes || audioBytes.byteLength === 0) {
        return json({ success: false, error: 'empty_audio_payload', message: 'No audio data received.' }, 400);
      }

      // Convert audio to 16kHz mono WAV if not already WAV
      let wavBytes: Uint8Array;
      if (isWav(audioBytes)) {
        wavBytes = audioBytes;
      } else {
        try {
          wavBytes = await convertOggOpusToWav16k(audioBytes);
        } catch (err: any) {
          console.error('Failed to decode Opus/Ogg audio:', err);
          return json(
            {
              success: false,
              error: 'audio_decode_failed',
              message: 'Unable to decode input audio. Ensure audio is valid WAV or Ogg Opus.',
              detail: err?.message,
            },
            422
          );
        }
      }

      // Transcribe with Meta ASR (muse-voice-transcribe-1.0)
      const asrResult = await callMetaAsr(wavBytes, {
        metaApiKey: metaToken,
        language: 'es',
        model: 'muse-voice-transcribe-1.0',
      });

      const transcript = asrResult.text.trim();
      if (!transcript) {
        return json(
          {
            success: false,
            error: 'empty_transcription',
            message: 'No speech was detected in the audio file.',
          },
          422
        );
      }

      // Extract transaction details from the voice transcript using Meta muse-spark-1.3
      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Transcripción de voz: "${transcript}". Extrae la transacción según las instrucciones.`,
        },
      ];

      const completion = await callMetaLlm(messages, { metaApiKey: metaToken });
      const result = parseJournalAiResponse(completion, categories);
      result.transcript = transcript;

      return json({ success: true, data: result });
    }

    // 3. Process Photo / Scanned Receipt
    if (actionType === 'photo') {
      if (!imageUrl) {
        return json({ success: false, error: 'empty_image_payload', message: 'No image provided.' }, 400);
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analiza este comprobante, factura o recibo. Extrae el concepto o comercio principal, el monto total, la categoría y el detalle de ítems en formato JSON según las instrucciones del sistema.',
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
          ],
        },
      ];

      const completion = await callMetaLlm(messages, { metaApiKey: metaToken });
      const result = parseJournalAiResponse(completion, categories);

      return json({ success: true, data: result });
    }

    return json({ success: false, error: 'unsupported_type', message: `Type "${actionType}" is not supported.` }, 400);
  } catch (error: any) {
    console.error('Journal AI error:', error);
    const status = error instanceof JournalAiError ? error.status : 500;
    const code = error instanceof JournalAiError ? error.code : 'internal_error';
    return json(
      {
        success: false,
        error: code,
        message: error?.message || 'An unexpected error occurred during processing.',
      },
      status
    );
  }
});

