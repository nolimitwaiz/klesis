import ggwave_factory from 'ggwave';
import { isIOS } from '../utils/helpers.js';

let ggwave = null;
let instance = null;
let engineSampleRate = 0;

const PROTOCOLS = {
  AUDIBLE_NORMAL:    { id: 0, name: 'Normal',    label: 'Audible Normal' },
  AUDIBLE_FAST:      { id: 1, name: 'Fast',      label: 'Audible Fast' },
  AUDIBLE_FASTEST:   { id: 2, name: 'Fastest',   label: 'Audible Fastest' },
  ULTRASOUND_NORMAL: { id: 3, name: 'Silent',    label: 'Ultrasound Normal' },
  ULTRASOUND_FAST:   { id: 4, name: 'Silent+',   label: 'Ultrasound Fast' },
  ULTRASOUND_FASTEST:{ id: 5, name: 'Silent++',  label: 'Ultrasound Fastest' },
};

const AUDIBLE_PROTOCOLS = [PROTOCOLS.AUDIBLE_NORMAL, PROTOCOLS.AUDIBLE_FAST, PROTOCOLS.AUDIBLE_FASTEST];
const ULTRASOUND_PROTOCOLS = [PROTOCOLS.ULTRASOUND_NORMAL, PROTOCOLS.ULTRASOUND_FAST, PROTOCOLS.ULTRASOUND_FASTEST];

const DEFAULT_PROTOCOL = PROTOCOLS.AUDIBLE_NORMAL;
const DEFAULT_VOLUME = 100;

/**
 * Initialize ggwave WASM with the browser's actual sample rate.
 */
async function initEngine(sampleRate, onProgress) {
  onProgress?.('Loading audio engine...');

  try {
    ggwave = await ggwave_factory();
  } catch (e) {
    throw new Error('Failed to load WASM audio engine: ' + (e.message || e));
  }

  if (!ggwave) {
    throw new Error('WASM audio engine returned null');
  }

  engineSampleRate = sampleRate;
  console.log('[klesis] Engine init with sample rate:', sampleRate);

  onProgress?.('Configuring...');
  const params = ggwave.getDefaultParameters();
  params.sampleFormatInp = ggwave.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  params.sampleFormatOut = ggwave.SampleFormat.GGWAVE_SAMPLE_FORMAT_F32;
  params.sampleRateInp = sampleRate;
  params.sampleRateOut = sampleRate;
  params.sampleRate = sampleRate;
  params.soundMarkerThreshold = 1.5;

  instance = ggwave.init(params);

  if (instance === null || instance === undefined) {
    throw new Error('ggwave.init() failed — could not create engine instance');
  }

  // Platform-aware ultrasound: only disable on iOS (broken there)
  if (isIOS()) {
    for (let i = 3; i <= 5; i++) {
      ggwave.rxToggleProtocol(i, 0);
    }
    console.log('[klesis] Ultrasound RX disabled (iOS)');
  } else {
    // Enable all protocols on desktop/Android
    for (let i = 0; i <= 5; i++) {
      ggwave.rxToggleProtocol(i, 1);
    }
    console.log('[klesis] All protocols enabled (including ultrasound)');
  }

  onProgress?.('Engine ready');
}

function encode(text, protocolId = DEFAULT_PROTOCOL.id, volume = DEFAULT_VOLUME) {
  if (!ggwave || instance === null) throw new Error('Engine not initialized');
  if (!text) throw new Error('Empty message');
  if (new TextEncoder().encode(text).length > 140) throw new Error('Message too long (max 140 bytes)');

  const raw = ggwave.encode(instance, text, protocolId, volume);
  if (!raw || raw.length === 0) throw new Error('Encode failed');

  const view = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  return new Float32Array(view);
}

function decode(samples) {
  if (!ggwave || instance === null) return null;

  const asInt8 = new Int8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  const result = ggwave.decode(instance, asInt8);

  if (!result || result.length === 0) return null;
  const text = new TextDecoder().decode(new Uint8Array(result));
  console.log('[klesis] Decoded message:', text);
  return text;
}

function destroyEngine() {
  if (ggwave && instance !== null) {
    ggwave.free(instance);
    instance = null;
  }
}

function isReady() {
  return ggwave !== null && instance !== null;
}

function getEngineSampleRate() {
  return engineSampleRate;
}

export {
  initEngine, encode, decode, destroyEngine, isReady,
  getEngineSampleRate, PROTOCOLS, AUDIBLE_PROTOCOLS, ULTRASOUND_PROTOCOLS,
  DEFAULT_PROTOCOL,
};
