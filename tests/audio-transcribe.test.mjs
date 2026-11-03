import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toMono,
  downsampleTo16k,
  encodeWav16k,
  isWav,
  isOgg,
  AudioTranscribeError,
  convertOggOpusToWav16k,
} from '../supabase/functions/_shared/audio-transcribe.ts';

test('toMono averages stereo channels correctly', () => {
  const left = new Float32Array([1.0, -0.5, 0.0]);
  const right = new Float32Array([0.0, 0.5, 1.0]);
  const mono = toMono([left, right]);
  assert.equal(mono.length, 3);
  assert.equal(mono[0], 0.5);
  assert.equal(mono[1], 0.0);
  assert.equal(mono[2], 0.5);
});

test('toMono returns empty Float32Array on empty input', () => {
  const mono = toMono([]);
  assert.equal(mono.length, 0);
});

test('downsampleTo16k downsamples 48kHz to 16kHz by factor of 3', () => {
  const samples48k = new Float32Array(48000);
  for (let i = 0; i < samples48k.length; i++) {
    samples48k[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
  }
  const samples16k = downsampleTo16k(samples48k, 48000);
  assert.equal(samples16k.length, 16000);
});

test('downsampleTo16k passes through 16kHz without alteration', () => {
  const original = new Float32Array([0.1, 0.2, 0.3]);
  const result = downsampleTo16k(original, 16000);
  assert.equal(result, original);
});

test('encodeWav16k generates valid 44-byte RIFF/WAVE header and PCM data', () => {
  const samples = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
  const wavBytes = encodeWav16k(samples);

  assert.equal(wavBytes.length, 44 + samples.length * 2);
  assert.equal(isWav(wavBytes), true);

  const view = new DataView(wavBytes.buffer);
  const riff = String.fromCharCode(...wavBytes.slice(0, 4));
  assert.equal(riff, 'RIFF');
  const wave = String.fromCharCode(...wavBytes.slice(8, 12));
  assert.equal(wave, 'WAVE');

  // Verify channels = 1 (mono)
  assert.equal(view.getUint16(22, true), 1);
  // Verify sample rate = 16000
  assert.equal(view.getUint32(24, true), 16000);
  // Verify bits per sample = 16
  assert.equal(view.getUint16(34, true), 16);
  // Verify data length
  assert.equal(view.getUint32(40, true), samples.length * 2);
});

test('isOgg detects Ogg container signature', () => {
  const oggHeader = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
  assert.equal(isOgg(oggHeader), true);
  const fakeHeader = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
  assert.equal(isOgg(fakeHeader), false);
});

test('convertOggOpusToWav16k converts decoded channels through injected decoder factory', async () => {
  class MockDecoder {
    ready = Promise.resolve();
    async decode(_bytes) {
      return {
        sampleRate: 48000,
        channelData: [new Float32Array(48000)],
      };
    }
    free() {}
  }

  const dummyOgg = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
  const wavBytes = await convertOggOpusToWav16k(dummyOgg, () => MockDecoder);
  assert.equal(isWav(wavBytes), true);
  // 1 second of 16kHz 16-bit mono = 32000 bytes + 44 bytes header = 32044 bytes
  assert.equal(wavBytes.length, 32044);
});

