# CLAUDE.md — @arraypress/waveform-sounds

A searchable, filterable list of sounds (sample-pack previews) built on
`@arraypress/waveform-player`. Peer of `waveform-playlist`, not a fork of it.

## Commands
- `npm test` — vitest + jsdom; `test/integration.test.js` runs against the
  REAL `@arraypress/waveform-player` (a devDependency from npm), the rest against
  the stand-in in `test/setup.js`.
- `npm run build` — iife, min, esm, cjs, no-autoinit (esm+cjs), render (esm+cjs), css.
- `npm run size` — currently ~13.9 KB JS / ~2.6 KB CSS gzipped.

## Architecture (`src/js/`) — by layer

```
index.js · entry.js · render-entry.js    entry points (each is a build target)
core/     WaveformSounds.js   the class: orchestration only
          engine.js           the engine player's options + per-sound peaks
          options.js          DEFAULT_OPTIONS, data-* parsing, merge
data/     sounds.js           pure: normalise, peaks codec, keys, facets, filter, sort
          url-state.js        pure: filters <-> the address
          navigation.js       pure: key targets, seek steps, paging
render/   markup.js           server-safe markup (toolbarPlan, renderMenu, renderRow…)
          options.js          render options + validation (DOM-free)
          html.js · icons.js · strings.js
dom/      menus.js            the dropdown controller (+ pure optionMatches/stepIndex)
          rows.js             row DOM: read back, index, order, visible
          draw.js · colors.js canvas drawing; colour + page-surface resolution
shared/   utils.js            clamp, pointerFraction, isTyping, emit, hashString
```

**Layering is enforced by imports, keep it:** `data/` and `shared/` import
nothing local but each other; `render/` imports `data/`, `shared/` and
itself (never `core/` or `dom/` — the `/render` entry must stay DOM-free);
`dom/` may use `data/` and `render/`; `core/` uses everything. Anything that
can be a pure function lives in `data/` (or `shared/`) with a unit test.
Tests mirror the tree: `test/unit/<layer>/<module>.test.js` (pure modules
run in the node environment), `test/runtime/` for the class and the real
core. Every function and method carries a JSDoc block.

## Rules
- **Never a WaveformPlayer per row.** A pack can have 300 sounds. Rows are
  pictures (low-res peaks, drawn only when on screen); ONE engine plays.
- **Supplied peaks also stop the hidden engine decoding the file** (the core
  only decodes when it has no peaks). A sound without peaks borrows the
  engine's decoded ones after its first play.
- **`index.d.ts` is hand-written** and the four `waveform-sounds-*` wrappers
  derive their props from it. New option → `DEFAULT_OPTIONS` (core/options.js; render-shaping ones in render/options.js),
  `readDataOptions` (data-* form), `index.d.ts`, and every wrapper's allowlist.
- **Option precedence is the family's: data-* > constructor > default.**
- Logging prefix `[WaveformSounds]`. Events are `waveformsounds:*`, bubbling.
- `render/`, `data/` and `shared/` must stay DOM-free: their tests run in the node
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

## Shared helpers come from @arraypress/text
`fold`, `words`, `matchesAll` (typo-tolerant search) and `escapeHtml` are
imported from `@arraypress/text` and BUNDLED into dist (a devDependency:
consumers install nothing). They need text **2.2.0**, unpublished as of
2026-10-07: the devDependency is `file:../../Core/text` until then — publish
text 2.2.0 FIRST, then switch it to `^2.2.0`. Not reused on purpose:
the player's `formatTime` / `extractTitleFromUrl` (different output, and the
player has no DOM-free entry the server renderer could import).

## Cross-repo
Wrappers: `waveform-sounds-astro` / `-react` / `-svelte` / `-vue`. Not yet in
the `waveform-release` skill's 15-package list — add it there on first publish.
Data: `waveform-gen --manifest` writes the `sounds.json` this reads.
