<div align="center">

# Waveform Sounds

**A searchable, filterable sound list for WaveformPlayer.**

Audition hundreds of sample previews: a mini waveform per row, search, type /
key / BPM filters, sort, loop, keyboard auditioning, and one shared audio
engine — never a player per row.

</div>

---

## Install

```bash
npm install @arraypress/waveform-player @arraypress/waveform-sounds
```

```js
import '@arraypress/waveform-player';
import '@arraypress/waveform-sounds';
import '@arraypress/waveform-player/styles.css';
import '@arraypress/waveform-sounds/styles.css';
```

```html
<div data-waveform-sounds data-manifest="/sounds.json"></div>
```

Generate the manifest from a folder of previews (BPM and key are read from
file names like `Bass_Loop_04_128_Fmin.wav`; the type is the sub-folder).
`--base-url` is the public URL the folder is served at:

```bash
npx @arraypress/waveform-gen ./public/previews/ --recursive \
  --manifest ./public/previews/sounds.json --base-url /previews/
```

(`--manifest` needs `@arraypress/waveform-gen` 2.1.0 or later.)

## Options

`player` (`'inline'` | `'strip'`), `search`, `filters`, `sorts`,
`loopToggle`, `showCount`, `pageSize` (50), `maxTypeChips` (10), `menuSearch` (8), `columns`,
`waveformStyle`, `waveformColor`, `progressColor`, `barWidth`, `barGap`,
`loop`, `autoAdvance`, `arrowAudition`, `playerOptions`, `strings`, and the
callbacks `onReady` / `onPlay` / `onPause` / `onEnd` / `onFilter` / `onError`.
Every option has a `data-*` form (`data-page-size="100"`); `strings` and
`playerOptions` take JSON. See `index.d.ts` for each one.

Every control can go. No BPM anywhere:

```js
{filters: ['type', 'key'], columns: ['type', 'key', 'duration'], sorts: ['default', 'title', 'key']}
```

## Keyboard

| Key | Does |
|---|---|
| ↑ / ↓ | Move between sounds; while one plays, play the next |
| ← / → | Seek the playing sound |
| Space / Enter | Play / pause |
| `/` | Search |

## Server rendering

```js
import {renderSounds} from '@arraypress/waveform-sounds/render';
const html = `<div data-waveform-sounds>${renderSounds(sounds, options)}</div>`;
```

The runtime adopts that markup instead of rebuilding it.

## Theming

Colour-agnostic by default, like the rest of the family: everything derives
from `currentColor`, and the "on" states (selected chip, playing row) are
inverted — white on a dark page, black on a light one. Custom properties on
`.waveform-sounds`: `--ws-accent` / `--ws-on-accent` (opt into a brand
colour), `--ws-surface` (the page background; detected, but set it for the
first server-rendered paint), `--ws-wave-color`, `--ws-progress-color`,
`--ws-border`, `--ws-radius`, `--ws-control-radius`, …

## License

MIT © [ArrayPress](https://github.com/arraypress)
