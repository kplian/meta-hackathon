// Pure helpers for Ogg Opus to WAV conversion and Meta ASR transcription.

export class AudioTranscribeError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

// Convert multi-channel Float32Array buffers to a single mono Float32Array
export function toMono(channels: Float32Array[]): Float32Array {
  if (!channels || !channels.length) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = channels[0].length;
  const mono = new Float32Array(length);
  const numChannels = channels.length;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      sum += channels[c][i];
    }
    mono[i] = sum / numChannels;
  }
  return mono;
}

// Downsample Float32Array samples to 16kHz mono using linear interpolation
export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input;
  if (!Number.isFinite(inputRate) || inputRate <= 0) {
    throw new AudioTranscribeError('invalid_sample_rate', 400);
  }
  const ratio = inputRate / 16000;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    const index1 = Math.floor(originalIndex);
    const index2 = Math.min(index1 + 1, input.length - 1);
    const fraction = originalIndex - index1;
    result[i] = input[index1] * (1 - fraction) + input[index2] * fraction;
  }
  return result;
}

// Write ASCII characters into DataView
function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// Encode Float32Array samples into a standard 16-bit mono 16kHz WAV buffer
export function encodeWav16k(samples: Float32Array): Uint8Array {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF Chunk Descriptor
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true); // ChunkSize
  writeAscii(view, 8, 'WAVE');

  // "fmt " Subchunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, 16000, true); // SampleRate (16000 Hz)
  view.setUint32(28, 32000, true); // ByteRate (16000 * 1 * 16 / 8 = 32000)
  view.setUint16(32, 2, true); // BlockAlign (1 * 16 / 8 = 2)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" Subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true); // Subchunk2Size

  // 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

// Detect if bytes match RIFF/WAVE header
export function isWav(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46 && // 'F'
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x41 && // 'A'
    bytes[10] === 0x56 && // 'V'
    bytes[11] === 0x45 // 'E'
  );
}

// Detect if bytes match OggS container header
export function isOgg(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 4) return false;
  return (
    bytes[0] === 0x4f && // 'O'
    bytes[1] === 0x67 && // 'g'
    bytes[2] === 0x67 && // 'g'
    bytes[3] === 0x53 // 'S'
  );
}

// Helper to decode Ogg Opus bytes to 16kHz mono WAV bytes
export async function convertOggOpusToWav16k(
  oggBytes: Uint8Array,
  decoderFactory?: () => any
): Promise<Uint8Array> {
  let DecoderClass: any;
  if (decoderFactory) {
    DecoderClass = decoderFactory();
  } else {
    // Dynamic import to allow running in environments without npm specifier support during unit tests
    const module = await import('npm:ogg-opus-decoder@0.4.11');
    DecoderClass = module.OggOpusDecoder;
  }

  const decoder = new DecoderClass();
  if (decoder.ready) {
    await decoder.ready;
  }
  try {
    const decoded = await decoder.decode(oggBytes);
    const mono = toMono(decoded.channelData);
    const resampled = downsampleTo16k(mono, decoded.sampleRate);
    return encodeWav16k(resampled);
  } finally {
    if (typeof decoder.free === 'function') {
      decoder.free();
    }
  }
}

// Helper to execute transcription request against Meta ASR endpoint
export async function callMetaAsr(
  wavBytes: Uint8Array,
  options: {
    metaApiKey: string;
    language?: string;
    model?: string;
  }
): Promise<{ text: string; raw: unknown }> {
  const model = options.model || 'muse-voice-transcribe-1.0';
  const language = options.language || 'es';

  const formData = new FormData();
  const requestJson = {
    model,
    language,
    audioEncoding: 'WAV',
    mode: 'PUSH_TO_TALK',
  };

  formData.append(
    'request',
    new Blob([JSON.stringify(requestJson)], { type: 'application/json' }),
    'request.json'
  );
  formData.append(
    'audio',
    new Blob([wavBytes], { type: 'audio/wav' }),
    'audio.wav'
  );

  const response = await fetch('https://api.meta.ai/v1/asr/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.metaApiKey}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new AudioTranscribeError(
      'meta_asr_error',
      response.status,
      body ? JSON.stringify(body) : `Meta ASR failed with HTTP ${response.status}`
    );
  }

  const text =
    body?.text ??
    body?.transcription ??
    body?.transcript ??
    body?.result?.text ??
    (Array.isArray(body?.results)
      ? body.results.map((r: any) => r.text || '').join(' ')
      : '') ??
    '';

  return { text: String(text).trim(), raw: body };
}

