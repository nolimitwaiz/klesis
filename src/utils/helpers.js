export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function supportsUltrasound() {
  // Ultrasound protocols 3-5 use 18-20kHz. Broken on iOS Safari.
  // Works on desktop Chrome/Firefox/Safari and some Android browsers.
  return !isIOS();
}

export function isMobile() {
  return window.innerWidth < 768;
}

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
