# CLAUDE.md — @arraypress/waveform-sounds

A searchable, filterable list of sounds (sample-pack previews) built on
`@arraypress/waveform-player`. Peer of `waveform-playlist`, not a fork of it.

## Commands
- `npm test` — vitest + jsdom; `test/integration.test.js` runs against the
  REAL `@arraypress/waveform-player` (a devDependency from npm), the rest against
  the stand-in in `test/setup.js`.
- `npm run build` — iife, min, esm, cjs, no-autoinit (esm+cjs), render (esm+cjs), css.
- `npm run size` — currently ~10.1 KB JS / ~1.9 KB CSS gzipped.

## Architecture (`src/js/`)
- `data.js` — pure: peaks codec, key normalisation, durations, normalise,
  manifest, facets, `matches`, `sortSounds`. No DOM.
- `render.js` — pure: the component's markup as a string. **The markup is the
  contract** between the server and the runtime: every class and `data-ws-*`
  attribute it writes is read by `core.js`.
- `draw.js` — the row waveform (canvas, resample, mirror/bars).
- `core.js` — `WaveformSounds`: adopt-or-render, toolbar, paging, lazy
  canvases (IntersectionObserver), one engine `WaveformPlayer`.
- `entry.js` — the public surface (no auto-init); `index.js` adds the scan;
  `render-entry.js` is the `/render` subpath.

## Rules
- **Never a WaveformPlayer per row.** A pack can have 300 sounds. Rows are
  pictures (low-res peaks, drawn only when on screen); ONE engine plays.
- **Supplied peaks also stop the hidden engine decoding the file** (the core
  only decodes when it has no peaks). A sound without peaks borrows the
  engine's decoded ones after its first play.
- **`index.d.ts` is hand-written** and the four `waveform-sounds-*` wrappers
  derive their props from it. New option → `DEFAULT_OPTIONS` (core.js),
  `readDataOptions` (data-* form), `index.d.ts`, and every wrapper's allowlist.
- **Option precedence is the family's: data-* > constructor > default.**
- Logging prefix `[WaveformSounds]`. Events are `waveformsounds:*`, bubbling.
- `render.js`/`data.js` must stay DOM-free: their tests run in the node
  environment and fail if they touch `window`.

## Verified in a real browser (2026-10-06)
300 real clips: 50 rows shown, 18 canvases drawn (only on-screen ones), play,
progress, click-seek, ↓ audition, `/` + typing, the type menu (54 types).
Seeking on a host that ignores byte ranges works through the core's cache
path — but only if the host sends cache headers (Cloudflare does; a bare
test server doesn't, and the seek then restarts the sound).

## One player class per page
The engine is built from `window.WaveformPlayer` (or `playerClass`). If two
copies of the player load (an IIFE `<script>` and a bundled ESM import), the
second overwrites the global and `singlePlay` can't pause across them — the
static `currentlyPlaying` is per copy. Wrappers must load the player only
when `window.WaveformPlayer` is absent.

## Cross-repo
Wrappers: `waveform-sounds-astro` / `-react` / `-svelte` / `-vue`. Not yet in
the `waveform-release` skill's 15-package list — add it there on first publish.
Data: `waveform-gen --manifest` writes the `sounds.json` this reads.
