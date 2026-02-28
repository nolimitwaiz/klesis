let canvas = null;
let ctx = null;
let animationId = 0;
let analyser = null;
let state = 'idle';
let displayWidth = 0;
let displayHeight = 0;
let isMobileView = false;

const COLORS = {
  idle:         '#D5D0CB',
  listening:    '#E8722A',
  transmitting: '#5B8C5A',
  decoding:     '#D4A72C',
};

const BAR_COUNT = 48;

export function initVisualizer(canvasEl, analyserNode) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  analyser = analyserNode;

  resize();
  window.addEventListener('resize', resize);

  state = 'listening';
  draw();
}

function resize() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  displayWidth = rect.width;
  displayHeight = rect.height;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  isMobileView = displayHeight <= 8;
}

function draw() {
  if (!ctx) return;

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  if (!analyser || state === 'idle') {
    drawIdleLine();
    animationId = requestAnimationFrame(draw);
    return;
  }

  if (isMobileView) {
    drawMobileLine();
  } else {
    drawDesktopBars();
  }

  animationId = requestAnimationFrame(draw);
}

function drawDesktopBars() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  const gap = 3;
  const barWidth = (displayWidth / BAR_COUNT) - gap;
  const step = Math.floor(bufferLength / BAR_COUNT);
  const color = COLORS[state] || COLORS.listening;
  const [r, g, b] = hexToRgb(color);

  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += dataArray[i * step + j];
    }
    const avg = sum / step;
    const barHeight = Math.max(2, (avg / 255) * displayHeight * 0.9);
    const x = i * (barWidth + gap);
    const y = displayHeight - barHeight;
    const alpha = 0.25 + (avg / 255) * 0.75;

    // Rounded bars
    const radius = Math.min(barWidth / 2, 3);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    roundRect(ctx, x, y, barWidth, barHeight, radius);

    // Bright cap
    if (barHeight > 6) {
      ctx.fillStyle = color;
      roundRect(ctx, x, y, barWidth, 3, radius);
    }
  }
}

function drawMobileLine() {
  // Thin animated line for mobile — fills proportional to audio level
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
  const avg = sum / bufferLength;
  const level = avg / 255;

  const color = COLORS[state] || COLORS.listening;
  const [r, g, b] = hexToRgb(color);

  // Background track
  ctx.fillStyle = '#F0ECE8';
  roundRect(ctx, 0, 0, displayWidth, displayHeight, displayHeight / 2);

  // Active fill
  const fillWidth = Math.max(displayHeight, level * displayWidth);
  const alpha = 0.4 + level * 0.6;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  roundRect(ctx, 0, 0, fillWidth, displayHeight, displayHeight / 2);
}

function drawIdleLine() {
  ctx.fillStyle = '#F0ECE8';
  if (isMobileView) {
    roundRect(ctx, 0, 0, displayWidth, displayHeight, displayHeight / 2);
  } else {
    const gap = 3;
    const barWidth = (displayWidth / BAR_COUNT) - gap;
    ctx.fillStyle = COLORS.idle;
    for (let i = 0; i < BAR_COUNT; i++) {
      ctx.fillRect(i * (barWidth + gap), displayHeight - 2, barWidth, 2);
    }
  }
}

function roundRect(context, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
  context.fill();
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function setVisualizerState(s) {
  state = s;
}

export function flashDecode() {
  const prev = state;
  state = 'decoding';
  setTimeout(() => { state = prev; }, 800);
}

export function stopVisualizer() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = 0;
  }
  state = 'idle';
  window.removeEventListener('resize', resize);
  if (ctx) {
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    drawIdleLine();
  }
}
