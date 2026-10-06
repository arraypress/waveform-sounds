# Changelog

All notable changes to `@arraypress/waveform-sounds` are documented here. The
format is based on [Keep a Changelog](https://keepachangelog.com/) and this
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-10-06

### Added

- First release: a searchable, filterable list of sounds for showcasing the
  previews inside a sample pack, preset bank or sound library.
- One `WaveformPlayer` (self mode) is the audio engine for the whole list, so
  playback gets the player's seeking (including hosts that ignore byte
  ranges), error handling, Media Session card and `singlePlay` hand-off.
- Two layouts: `inline` (a mini waveform per row; the playing row fills and
  is click-to-seek) and `strip` (plain rows, the engine docked below).
- Search (every word, any order; a number matches the BPM), type chips (a
  menu past `maxTypeChips`), key menu, BPM range, sort, Loop toggle, paging.
- Keyboard: ↑/↓ move and, while a sound plays, audition the next; ←/→ seek;
  `/` focuses the search; ↓ from the search enters the list.
- Peaks as an 8-bit hex string (two characters per bar).
- `@arraypress/waveform-sounds/render`: a DOM-free renderer for server
  rendering; the runtime adopts its markup instead of rebuilding it.
- `@arraypress/waveform-sounds/no-autoinit`.
- Dropdowns for type (past `maxTypeChips`), key and sort: a button and a
  popup listbox, with a search field past `menuSearch` (8) options; ↑/↓,
  Enter, Esc, type to narrow (WAI-ARIA combobox/listbox).
- Every control is optional: `search`, `filters`, `sorts` (which orders,
  in order; the first is the starting order), `loopToggle`, `showCount`,
  `columns`.
- Colour-agnostic by default: the "on" states are inverted (text colour as
  fill, page surface as ink). The surface is detected (`--ws-surface`) and
  re-read on theme flips; set it yourself for the first server paint.
