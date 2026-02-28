import { initEngine, PROTOCOLS, DEFAULT_PROTOCOL } from '../audio/engine.js';
import { getAudioContext, startCapture, getAnalyserNode, getAudioLevels, unlockIOSAudio } from '../audio/capture.js';
import { transmit, estimateDuration } from '../audio/playback.js';
import { initChat, addMessage, setSendEnabled, setDurationEstimate, setStatusMode, setStatusInfo, updateProtocolUI } from './chat.js';
import { initVisualizer, setVisualizerState, flashDecode } from './visualizer.js';
import { showToast } from './notifications.js';
import { isIOS, supportsUltrasound } from '../utils/helpers.js';

let currentProtocol = DEFAULT_PROTOCOL;
let silentMode = false;

/**
 * Boot the application. Shows splash, waits for user gesture, then enters active state.
 */
export async function bootApp(appEl) {
  appEl.innerHTML = `
    <div class="splash-wrap">
      <div class="splash">
        <h1 class="brand-logo">KLESIS</h1>
        <p class="brand-tagline">sound · text · air</p>
        <div id="splash-status" class="splash-status"></div>
        <button id="start-btn" class="btn-start">Start Listening</button>
      </div>
    </div>
  `;

  const status = appEl.querySelector('#splash-status');
  const startBtn = appEl.querySelector('#start-btn');

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';

    try {
      // 1. Unlock iOS audio session (mute switch workaround)
      status.textContent = 'Unlocking audio...';
      await unlockIOSAudio();

      // 2. Create AudioContext from user gesture
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const actualRate = ctx.sampleRate;
      console.log('[klesis] Actual device sample rate:', actualRate);

      // 3. Load WASM and init engine
      status.textContent = 'Loading audio engine...';
      await initEngine(actualRate, (msg) => { status.textContent = msg; });

      // 4. Enter active state
      status.textContent = 'Requesting microphone...';
      await enterActiveState(appEl, actualRate);
    } catch (e) {
      console.error('[klesis] Boot error:', e);
      startBtn.disabled = false;
      startBtn.textContent = 'Start Listening';
      status.textContent = 'Error: ' + e.message;
      status.classList.add('error');
      showToast('Error: ' + e.message, 'error');
    }
  });
}

async function enterActiveState(appEl, sampleRate) {
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  appEl.innerHTML = '';
  appEl.appendChild(shell);

  // Initialize chat UI with protocol change callbacks
  initChat(shell, handleSend, {
    onProtocolChange: handleProtocolChange,
    onSilentToggle: handleSilentToggle,
  });

  setStatusInfo(`${sampleRate} Hz`);

  // Start microphone capture
  await startCapture({
    onMessage: handleReceive,
    onError: (e) => showToast(e.message, 'error', 5000),
  });

  // Initialize visualizer
  const canvasEl = shell.querySelector('#visualizer');
  const analyser = getAnalyserNode();
  if (canvasEl && analyser) {
    initVisualizer(canvasEl, analyser);
  }

  // Start in listening state
  setStatusMode('listening');
  setVisualizerState('listening');

  // Live signal meter
  startSignalMeter();

  // Platform warnings
  if (isIOS()) {
    showToast('Audio unlocked. Works even with mute switch on.', 'success', 3000);
  }

  // Keep screen on
  requestWakeLock();
}

async function handleSend(text) {
  addMessage(text, 'sent');
  setSendEnabled(false);
  setVisualizerState('transmitting');

  const duration = estimateDuration(text, currentProtocol.id);
  const durationStr = `~${duration.toFixed(1)}s`;
  setDurationEstimate(durationStr);
  setStatusMode('transmitting', durationStr);

  await transmit(text, currentProtocol.id, {
    onStart: () => {
      console.log('[klesis] Transmit started');
    },
    onEnd: () => {
      setDurationEstimate('');
      setStatusMode('listening');
      setVisualizerState('listening');
      setSendEnabled(true);
    },
    onError: (e) => {
      setDurationEstimate('');
      setStatusMode('listening');
      setVisualizerState('listening');
      setSendEnabled(true);
      showToast('Send failed: ' + e.message, 'error');
    },
  });
}

function handleReceive(text) {
  addMessage(text, 'received');
  flashDecode();
  setStatusMode('received');
  showToast('Message received!', 'success');

  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
  }
}

function handleProtocolChange(protocolId, isSilent) {
  silentMode = isSilent;

  if (isSilent) {
    currentProtocol = PROTOCOLS.ULTRASOUND_NORMAL;
  } else {
    // Find by ID
    const found = Object.values(PROTOCOLS).find(p => p.id === protocolId);
    currentProtocol = found || PROTOCOLS.AUDIBLE_NORMAL;
  }

  updateProtocolUI(currentProtocol.id, silentMode);

  const label = silentMode ? 'Silent mode' : currentProtocol.label;
  showToast(`Protocol: ${label}`, 'info', 2000);
  console.log('[klesis] Protocol changed:', currentProtocol.label, 'silent:', silentMode);
}

function handleSilentToggle(enabled) {
  silentMode = enabled;

  if (enabled) {
    currentProtocol = PROTOCOLS.ULTRASOUND_NORMAL;
  } else {
    currentProtocol = PROTOCOLS.AUDIBLE_NORMAL;
  }

  updateProtocolUI(currentProtocol.id, silentMode);

  const label = silentMode ? 'Silent mode enabled' : 'Silent mode off';
  showToast(label, 'info', 2000);
  console.log('[klesis] Silent mode:', silentMode);
}

function startSignalMeter() {
  const fill = document.getElementById('signal-fill');
  if (!fill) return;

  function update() {
    const { rms } = getAudioLevels();
    const pct = Math.min(rms * 1000, 100);
    fill.style.width = pct + '%';
    fill.classList.toggle('hot', pct > 50);
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try { await navigator.wakeLock.request('screen'); } catch {}
  }
}
