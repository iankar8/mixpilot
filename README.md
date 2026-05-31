# mixmash

Browser-first AI-assisted mashup instrument for two-song stem performance.

The current prototype focuses on:

- Loading two local stem-separated songs into A/B slots.
- Browser-cached track analysis for BPM, phrase markers, and sync confidence.
- Auto-sync that applies tempo and phase alignment without putting AI in the live keypress loop.
- AI-suggested mashup scenes for stem swaps and hook/beat combinations.
- A piano-style performance keyboard for scenes, stems, and fades.
- A first production lane for synced 808/drum ideas.

## Development

```sh
npm install
npm run dev
```

Run the local model/audio-analysis sidecar in another terminal:

```sh
npm run sidecar
```

The sidecar listens on `127.0.0.1:8787`, uses the local Claude CLI login for model-backed scene suggestions, and caches background track analysis in `~/.mixmash/track-analysis-cache.json`.

## Verification

```sh
npm run lint
npm run build
```
