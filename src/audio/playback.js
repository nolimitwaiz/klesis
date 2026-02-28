import { encode, getEngineSampleRate } from './engine.js';
import { getAudioContext, muteCapture, unmuteCapture } from './capture.js';

const SETTLE_MS = 100;
const UNMUTE_DELAY_MS = 500;

let isTransmitting = false;

/**
 * Transmit a text message as sound.
 */
export async function transmit(text, protocolId, { onStart, onEnd, onError } = {}) {
  if (isTransmitting) {
    onError?.(new Error('Already transmitting'));
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    onError?.(new Error('AudioContext not available'));
    return;
  }

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  try {
    isTransmitting = true;
    const sampleRate = getEngineSampleRate();

    const samples = encodeWithCache(text, protocolId);

    // Log peak amplitude for diagnostics
    let maxAmp = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = Math.abs(samples[i]);
      if (v > maxAmp) maxAmp = v;
    }
    console.log('[klesis] Encoded', samples.length, 'samples at', sampleRate, 'Hz =', (samples.length / sampleRate).toFixed(2) + 's');
    console.log('[klesis] Encoded peak amplitude:', maxAmp.toFixed(4), '→ after 2x gain:', (maxAmp * 2.0).toFixed(4));

    const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
    audioBuffer.getChannelData(0).set(samples);

    muteCapture();
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    // Boost output with GainNode for louder cross-device transmission
    // 2.0 provides good loudness without excessive clipping (3.0 clips ~14%)
    const gainNode = ctx.createGain();
    gainNode.gain.value = 2.0;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        console.log('[klesis] Playback ended, waiting', UNMUTE_DELAY_MS, 'ms before unmute');
        setTimeout(() => {
          unmuteCapture();
          isTransmitting = false;
          onEnd?.();
          resolve();
        }, UNMUTE_DELAY_MS);
      };

      onStart?.();
      source.start(0);
      console.log('[klesis] Playback started');
    });
  } catch (e) {
    isTransmitting = false;
    unmuteCapture();
    onError?.(e);
  }
}

// Cache last encode result to avoid double-encoding when estimateDuration
// is called right before transmit with the same text
let lastEncodeCache = { text: null, protocolId: null, samples: null };

/**
 * Estimate transmission duration in seconds.
 * Caches the encoded samples so the subsequent transmit() doesn't re-encode.
 */
export function estimateDuration(text, protocolId) {
  try {
    if (lastEncodeCache.text === text && lastEncodeCache.protocolId === protocolId) {
      return lastEncodeCache.samples.length / getEngineSampleRate();
    }
    const samples = encode(text, protocolId);
    lastEncodeCache = { text, protocolId, samples };
    return samples.length / getEngineSampleRate();
  } catch {
    return 0;
  }
}

/**
 * Get cached encoded samples if available, otherwise encode fresh.
 */
function encodeWithCache(text, protocolId) {
  if (lastEncodeCache.text === text && lastEncodeCache.protocolId === protocolId && lastEncodeCache.samples) {
    const samples = lastEncodeCache.samples;
    lastEncodeCache = { text: null, protocolId: null, samples: null };
    return samples;
  }
  return encode(text, protocolId);
}

export function getIsTransmitting() {
  return isTransmitting;
}
