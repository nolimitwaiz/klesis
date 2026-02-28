# Klesis

**Send text through sound.**

A progressive web app that encodes text into audible sound waves and decodes them on nearby devices — no internet, no pairing, no Bluetooth. Just sound through air.

🔊 **[Try it live](https://nolimitwaiz.github.io/klesis/)**

## Features

- **Acoustic messaging** — encode and decode text via sound using [ggwave](https://github.com/ggerganov/ggwave)
- **6 protocol modes** — 3 audible speeds + 3 ultrasound speeds
- **Real-time visualizer** — frequency spectrum bars on desktop, fill bar on mobile
- **Works offline** — full PWA with service worker caching
- **Installable** — add to home screen on iOS and Android
- **140-byte messages** — compact UTF-8 payloads
- **Echo prevention** — mic mutes during playback to avoid self-reception

## Quick Start

```bash
npm install
npm run dev
```

## Tech Stack

Vanilla JS · Vite 6 · ggwave 0.4.0 (WASM) · Web Audio API · Canvas

## Platform Notes

Ultrasound protocols (modes 4–6) are broken on iOS/Safari due to Web Audio limitations. Audible protocols work fine everywhere.
