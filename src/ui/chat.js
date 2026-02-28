import { formatTime, byteLength, escapeHtml, isMobile, supportsUltrasound } from '../utils/helpers.js';

const messages = [];
const MAX_BYTES = 140;

let messagesEl = null;
let emptyEl = null;
let inputEl = null;
let charCounterEl = null;
let sendBtn = null;
let durationEl = null;
let statusDotEl = null;
let statusLabelEl = null;
let statusDetailEl = null;
let onSendCb = null;

// Protocol pill elements
let pillNormalEl = null;
let pillSilentEl = null;
let protocolLabelMobileEl = null;

// Drawer elements
let drawerBackdropEl = null;
let settingsDrawerEl = null;
let drawerPillNormalEl = null;
let drawerPillFastEl = null;
let drawerPillFastestEl = null;
let drawerPillSilentEl = null;
let drawerSilentHelpEl = null;

export function initChat(container, onSend, { onProtocolChange, onSilentToggle } = {}) {
  onSendCb = onSend;

  const ultrasoundSupported = supportsUltrasound();

  container.innerHTML = `
    <header class="app-header">
      <div class="header-brand">
        <h1>KLESIS</h1>
        <span class="header-tagline">sound · text · air</span>
      </div>
      <div class="header-actions">
        <span class="protocol-label-mobile" id="protocol-label-mobile">Normal</span>
        <div class="settings-btn-wrap">
          <button class="icon-btn" id="settings-btn" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="status-strip" id="status-bar">
      <span class="status-dot listening" id="status-dot"></span>
      <span class="status-label" id="status-label">Listening</span>
      <div class="signal-meter" id="signal-meter">
        <div class="signal-fill" id="signal-fill"></div>
      </div>
      <span class="status-detail" id="status-detail"></span>
    </div>

    <div id="messages" class="messages">
      <div class="messages-empty" id="messages-empty">
        <div class="messages-empty-icon">~</div>
        <div class="messages-empty-text">
          Messages sent through sound will appear here.<br>
          Type below and press send.
        </div>
      </div>
    </div>

    <div class="visualizer-wrap" id="viz-wrap">
      <canvas id="visualizer"></canvas>
    </div>

    <div class="input-area" id="input-area">
      <div class="input-row">
        <input id="msg-input" type="text" placeholder="Type a message..."
               maxlength="200" autocomplete="off" autocapitalize="off">
        <button id="send-btn" class="send-btn" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
      <div class="input-footer">
        <div class="protocol-pills protocol-pills-inline">
          <button class="pill active" id="pill-normal">Normal</button>
          <button class="pill" id="pill-silent" ${!ultrasoundSupported ? 'disabled title="Not supported on this device"' : ''}>Silent</button>
        </div>
        <div>
          <span id="duration-est" class="duration-est"></span>
          <span id="char-counter" class="char-count">0/140</span>
        </div>
      </div>
    </div>

    <!-- Settings Drawer (mobile) -->
    <div class="drawer-backdrop" id="drawer-backdrop"></div>
    <div class="settings-drawer" id="settings-drawer">
      <div class="drawer-handle"></div>
      <div class="drawer-title">Settings</div>
      <div class="setting-group">
        <div class="setting-label">Speed</div>
        <div class="drawer-pills">
          <button class="pill active" id="drawer-pill-normal">Normal</button>
          <button class="pill" id="drawer-pill-fast">Fast</button>
          <button class="pill" id="drawer-pill-fastest">Fastest</button>
        </div>
      </div>
      <div class="setting-group">
        <div class="setting-label">Silent Mode</div>
        <div class="drawer-pills">
          <button class="pill" id="drawer-pill-silent" ${!ultrasoundSupported ? 'disabled' : ''}>
            Ultrasound
          </button>
        </div>
        <div class="setting-help" id="drawer-silent-help">
          ${ultrasoundSupported
            ? 'Uses ~18-20kHz frequencies inaudible to humans. Both devices must have silent mode enabled.'
            : 'Not supported on this device. Ultrasound protocols require a non-iOS browser.'}
        </div>
      </div>
    </div>
  `;

  // Cache DOM refs
  messagesEl = container.querySelector('#messages');
  emptyEl = container.querySelector('#messages-empty');
  inputEl = container.querySelector('#msg-input');
  charCounterEl = container.querySelector('#char-counter');
  sendBtn = container.querySelector('#send-btn');
  durationEl = container.querySelector('#duration-est');
  statusDotEl = container.querySelector('#status-dot');
  statusLabelEl = container.querySelector('#status-label');
  statusDetailEl = container.querySelector('#status-detail');

  // Protocol pills (desktop inline)
  pillNormalEl = container.querySelector('#pill-normal');
  pillSilentEl = container.querySelector('#pill-silent');
  protocolLabelMobileEl = container.querySelector('#protocol-label-mobile');

  // Settings drawer
  drawerBackdropEl = container.querySelector('#drawer-backdrop');
  settingsDrawerEl = container.querySelector('#settings-drawer');
  drawerPillNormalEl = container.querySelector('#drawer-pill-normal');
  drawerPillFastEl = container.querySelector('#drawer-pill-fast');
  drawerPillFastestEl = container.querySelector('#drawer-pill-fastest');
  drawerPillSilentEl = container.querySelector('#drawer-pill-silent');
  drawerSilentHelpEl = container.querySelector('#drawer-silent-help');

  // Input listeners
  inputEl.addEventListener('input', onInput);
  sendBtn.addEventListener('click', doSend);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Settings drawer open/close
  const settingsBtn = container.querySelector('#settings-btn');
  settingsBtn?.addEventListener('click', openDrawer);
  drawerBackdropEl?.addEventListener('click', closeDrawer);

  // Protocol pill listeners (desktop)
  pillNormalEl?.addEventListener('click', () => {
    setActivePill('normal');
    onProtocolChange?.(0, false);
  });
  pillSilentEl?.addEventListener('click', () => {
    if (!ultrasoundSupported) return;
    setActivePill('silent');
    onProtocolChange?.(3, true);
  });

  // Drawer protocol listeners
  drawerPillNormalEl?.addEventListener('click', () => {
    setDrawerSpeed('normal');
    onProtocolChange?.(0, false);
    closeDrawer();
  });
  drawerPillFastEl?.addEventListener('click', () => {
    setDrawerSpeed('fast');
    onProtocolChange?.(1, false);
    closeDrawer();
  });
  drawerPillFastestEl?.addEventListener('click', () => {
    setDrawerSpeed('fastest');
    onProtocolChange?.(2, false);
    closeDrawer();
  });
  drawerPillSilentEl?.addEventListener('click', () => {
    if (!ultrasoundSupported) return;
    const isActive = drawerPillSilentEl.classList.contains('active');
    if (isActive) {
      drawerPillSilentEl.classList.remove('active');
      onSilentToggle?.(false);
    } else {
      drawerPillSilentEl.classList.add('active');
      onSilentToggle?.(true);
    }
    closeDrawer();
  });
}

function onInput() {
  const bytes = byteLength(inputEl.value);
  charCounterEl.textContent = `${bytes}/140`;
  charCounterEl.classList.toggle('over-limit', bytes > MAX_BYTES);
  sendBtn.disabled = bytes === 0 || bytes > MAX_BYTES;
}

function doSend() {
  const text = inputEl.value.trim();
  if (!text || byteLength(text) > MAX_BYTES) return;
  onSendCb?.(text);
  inputEl.value = '';
  charCounterEl.textContent = '0/140';
  sendBtn.disabled = true;
}

// ── Messages ──────────────────────────────────

export function addMessage(text, type) {
  const msg = { text, type, time: new Date() };
  messages.push(msg);

  // Hide empty state
  if (emptyEl) {
    emptyEl.remove();
    emptyEl = null;
  }

  renderMessage(msg);
  scrollToBottom();

  if (type === 'received' && navigator.vibrate) {
    navigator.vibrate(50);
  }
}

function renderMessage(msg) {
  const el = document.createElement('div');
  el.className = `message message-${msg.type}`;
  const time = formatTime(msg.time);

  if (msg.type === 'system') {
    el.innerHTML = `<span class="system-text">${escapeHtml(msg.text)}</span>`;
  } else {
    el.innerHTML = `
      <div class="bubble bubble-${msg.type}">
        <span class="bubble-text">${escapeHtml(msg.text)}</span>
        <span class="bubble-time">${time}</span>
      </div>`;
  }

  messagesEl.appendChild(el);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// ── Status Bar ────────────────────────────────

export function setStatusMode(mode, extra) {
  if (!statusDotEl || !statusLabelEl) return;

  statusDotEl.className = 'status-dot ' + mode;

  switch (mode) {
    case 'listening':
      statusLabelEl.textContent = 'Listening';
      break;
    case 'transmitting':
      statusLabelEl.textContent = extra ? `Sending ${extra}` : 'Sending...';
      break;
    case 'received':
      statusLabelEl.textContent = 'Received';
      setTimeout(() => setStatusMode('listening'), 2000);
      break;
    default:
      statusLabelEl.textContent = mode;
  }
}

export function setStatusInfo(text) {
  if (statusDetailEl) statusDetailEl.textContent = text;
}

export function setDurationEstimate(text) {
  if (durationEl) durationEl.textContent = text;
}

export function setSendEnabled(enabled) {
  if (inputEl) inputEl.disabled = !enabled;
  if (sendBtn) sendBtn.disabled = !enabled;
}

// ── Protocol Pills ────────────────────────────

function setActivePill(mode) {
  if (pillNormalEl && pillSilentEl) {
    pillNormalEl.classList.toggle('active', mode === 'normal');
    pillSilentEl.classList.toggle('active', mode === 'silent');
  }
  if (protocolLabelMobileEl) {
    protocolLabelMobileEl.textContent = mode === 'silent' ? 'Silent' : 'Normal';
  }
}

function setDrawerSpeed(speed) {
  drawerPillNormalEl?.classList.toggle('active', speed === 'normal');
  drawerPillFastEl?.classList.toggle('active', speed === 'fast');
  drawerPillFastestEl?.classList.toggle('active', speed === 'fastest');
}

export function updateProtocolUI(protocolId, isSilent) {
  setActivePill(isSilent ? 'silent' : 'normal');

  if (!isSilent) {
    if (protocolId === 0) setDrawerSpeed('normal');
    else if (protocolId === 1) setDrawerSpeed('fast');
    else if (protocolId === 2) setDrawerSpeed('fastest');
  }

  if (drawerPillSilentEl) {
    drawerPillSilentEl.classList.toggle('active', isSilent);
  }
}

// ── Drawer ────────────────────────────────────

function openDrawer() {
  drawerBackdropEl?.classList.add('visible');
  settingsDrawerEl?.classList.add('visible');
}

function closeDrawer() {
  drawerBackdropEl?.classList.remove('visible');
  settingsDrawerEl?.classList.remove('visible');
}

export function getInputElement() {
  return inputEl;
}
