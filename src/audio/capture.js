import { decode } from './engine.js';
import { isIOS } from '../utils/helpers.js';

let audioContext = null;
let mediaStream = null;
let scriptProcessor = null;
let analyserNode = null;
let muted = false;
let onMessageCb = null;
let processCount = 0;
let currentRms = 0;
let currentPeak = 0;

const BUFFER_SIZE = 4096;
const FFT_SIZE = 2048;

/**
 * Unlock iOS audio session so Web Audio plays through the media channel
 * instead of the ringer channel. This makes audio work even with the
 * mute switch on. Must be called from a user gesture.
 */
export function unlockIOSAudio() {
  if (!isIOS()) return Promise.resolve();

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = (import.meta.env.BASE_URL || '/') + 'silence.mp3';
    audio.playsInline = true;
    audio.volume = 0.01;

    const onEnd = () => {
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onEnd);
      console.log('[klesis] iOS audio session unlocked');
      resolve();
    };

    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onEnd);
    audio.play().catch(() => resolve());
  });
}

/**
 * Get or create AudioContext. Let the browser pick its native sample rate.
 * Must be called from user gesture on iOS.
 */
export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('[klesis] AudioContext created, actual sample rate:', audioContext.sampleRate);

    // Re-resume AudioContext when user returns to the tab
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  return audioContext;
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && audioContext && audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      console.log('[klesis] AudioContext resumed after visibility change');
    }).catch(() => {});
  }
}

/**
 * Start microphone capture and begin decoding.
 */
export async function startCapture({ onMessage, onError }) {
  onMessageCb = onMessage;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
    if (ctx.state !== 'running') {
      onError?.(new Error('AudioContext failed to resume. Tap the screen and try again.'));
      return;
    }
  }
  console.log('[klesis] AudioContext state:', ctx.state, 'sampleRate:', ctx.sampleRate);

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
      },
    });
    console.log('[klesis] Microphone access granted');
  } catch (e) {
    console.error('[klesis] Mic error:', e.name, e.message);
    if (e.name === 'NotAllowedError') {
      onError?.(new Error('Microphone access denied. Check browser settings.'));
    } else if (e.name === 'NotFoundError') {
      onError?.(new Error('No microphone found on this device.'));
    } else {
      onError?.(new Error('Audio error: ' + e.message));
    }
    return;
  }

  const source = ctx.createMediaStreamSource(mediaStream);

  const inputGainNode = ctx.createGain();
  inputGainNode.gain.value = 2.0;

  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = FFT_SIZE;
  analyserNode.smoothingTimeConstant = 0.8;

  scriptProcessor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
  processCount = 0;

  scriptProcessor.onaudioprocess = (event) => {
    processCount++;
    const inputData = event.inputBuffer.getChannelData(0);

    const outputData = event.outputBuffer.getChannelData(0);
    outputData.fill(0);

    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < inputData.length; i++) {
      const v = Math.abs(inputData[i]);
      sumSq += inputData[i] * inputData[i];
      if (v > peak) peak = v;
    }
    const rms = Math.sqrt(sumSq / inputData.length);
    currentRms = rms;
    currentPeak = peak;

    if (rms > 0.01 && processCount % 5 === 0) {
      console.log(`[klesis] SIGNAL DETECTED | rms=${rms.toFixed(4)} | peak=${peak.toFixed(4)}`);
    }

    const decoded = decode(inputData);

    if (processCount % 50 === 1) {
      console.log(`[klesis] chunk #${processCount} | muted=${muted} | rms=${rms.toFixed(5)} | peak=${peak.toFixed(4)} | decoded=${decoded ? '"' + decoded + '"' : 'null'}`);
    }

    if (decoded) {
      console.log('[klesis] DECODED:', decoded, '| muted:', muted);
      if (!muted) {
        onMessageCb?.(decoded);
      }
    }
  };

  source.connect(inputGainNode);
  inputGainNode.connect(analyserNode);
  analyserNode.connect(scriptProcessor);
  scriptProcessor.connect(ctx.destination);

  console.log('[klesis] Capture pipeline started');
}

export function stopCapture() {
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor.onaudioprocess = null;
    scriptProcessor = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

export function muteCapture() {
  muted = true;
  console.log('[klesis] Capture muted');
}

export function unmuteCapture() {
  muted = false;
  console.log('[klesis] Capture unmuted');
}

export function getAnalyserNode() {
  return analyserNode;
}

export function getAudioLevels() {
  return { rms: currentRms, peak: currentPeak };
}
