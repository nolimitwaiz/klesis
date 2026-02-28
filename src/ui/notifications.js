let toastContainer = null;

function ensureContainer() {
  if (toastContainer) return;
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} [type='info']
 * @param {number} [duration=3000] ms, 0 for manual dismiss
 */
export function showToast(message, type = 'info', duration = 3000) {
  ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.addEventListener('click', () => removeToast(toast));

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-exit');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}
