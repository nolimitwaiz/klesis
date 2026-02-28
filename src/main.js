import './styles/main.css';
import { bootApp } from './ui/controls.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

bootApp(document.getElementById('app'));
