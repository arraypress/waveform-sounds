/**
 * Server-safe renderer: the component's markup as an HTML string, from the
 * same data helpers the browser uses. No DOM, no window.
 *
 * A wrapper that renders on the server (Astro, SSR React/Vue/Svelte) calls
 * {@link renderSounds} and emits the result inside a
 * `[data-waveform-sounds]` element; the browser runtime then ADOPTS that
 * markup instead of building its own, so the list is there (and readable,
 * and crawlable) before any script runs.
 *
 * The markup is the contract between the two halves: every class and
 * `data-ws-*` attribute here is read by `core.js`.
 *
 * @module render
 */

import {encodePeaks, facets, formatDuration, normalizeSounds, SORTS} from './data.js';

/** UI strings. Every visible or announced word, so a site can translate. */
export const DEFAULT_STRINGS = {
    search: 'Search sounds',
    searchPlaceholder: 'Search sounds…',
    all: 'All',
    types: 'Type',
    key: 'Key',
    anyKey: 'Any key',
    allTypes: 'All types',
    bpm: 'BPM',
    bpmMin: 'Min BPM',
    bpmMax: 'Max BPM',
    sort: 'Sort',
    sortDefault: 'Default',
    sortTitle: 'Name',
    sortBpm: 'BPM',
    sortKey: 'Key',
    sortDuration: 'Length',
    loop: 'Loop',
    play: 'Play {title}',
    pause: 'Pause {title}',
    seek: 'Seek {title}',
    count: '{count} sounds',
    countOne: '1 sound',
    countFiltered: '{count} of {total} sounds',
    showMore: 'Show {count} more',
    empty: 'No sounds match.',
    clear: 'Clear filters',
    nowPlaying: 'Playing {title}',
};

/** The option values the renderer needs; the runtime has the full set. */
export const RENDER_DEFAULTS = {
    player: 'inline',
    search: true,
    filters: ['type', 'key', 'bpm'],
    sortable: true,
    loopToggle: true,
    pageSize: 50,
    columns: ['type', 'bpm', 'key', 'duration'],
    maxTypeChips: 10,
};

/** Escape text for HTML content and double-quoted attributes. */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Fill `{name}` placeholders. */
export function fill(template, vars = {}) {
    return String(template).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * The count line: "300 sounds", "1 sound", "12 of 300 sounds".
 * @param {number} shown
 * @param {number} total
 * @param {Object} strings
 */
export function countText(shown, total, strings = DEFAULT_STRINGS) {
    if (shown !== total) return fill(strings.countFiltered, {count: shown, total});
    return total === 1 ? strings.countOne : fill(strings.count, {count: total});
}

const ICON_PLAY = '<svg class="ws-icon ws-icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>';
const ICON_PAUSE = '<svg class="ws-icon ws-icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
const ICON_SEARCH = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"/></svg>';
const ICON_LOOP = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 4l3 3-3 3V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V4zM7 20l-3-3 3-3v2h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v2z"/></svg>';

/**
 * Merge render options with their defaults and validate the enumerations.
 * @param {Object} options
 */
export function resolveRenderOptions(options = {}) {
    const o = {...RENDER_DEFAULTS, ...stripUndefined(options)};
    if (o.player !== 'strip') o.player = 'inline';
    o.filters = Array.isArray(o.filters) ? o.filters.filter((f) => ['type', 'key', 'bpm'].includes(f)) : RENDER_DEFAULTS.filters;
    o.columns = Array.isArray(o.columns) ? o.columns.filter((c) => ['type', 'bpm', 'key', 'duration'].includes(c)) : RENDER_DEFAULTS.columns;
    o.maxTypeChips = Number.isFinite(Number(o.maxTypeChips)) && Number(o.maxTypeChips) >= 0 ? Math.floor(Number(o.maxTypeChips)) : RENDER_DEFAULTS.maxTypeChips;
    o.pageSize = Number.isFinite(Number(o.pageSize)) && Number(o.pageSize) >= 0 ? Math.floor(Number(o.pageSize)) : RENDER_DEFAULTS.pageSize;
    o.strings = {...DEFAULT_STRINGS, ...stripUndefined(options.strings || {})};
    return o;
}

function stripUndefined(obj) {
    const out = {};
    for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
    return out;
}

/**
 * One row. `index` is the sound's position in the ORIGINAL list: the
 * runtime maps rows back to sounds through it, whatever order they are
 * sorted into.
 */
export function renderRow(sound, index, o, hidden = false) {
    const s = o.strings;
    const attrs = [
        `class="ws-row"`,
        `data-ws-index="${index}"`,
        `data-ws-id="${escapeHtml(sound.id)}"`,
        `data-url="${escapeHtml(sound.url)}"`,
        `data-title="${escapeHtml(sound.title)}"`,
        sound.type ? `data-type="${escapeHtml(sound.type)}"` : '',
        sound.bpm != null ? `data-bpm="${sound.bpm}"` : '',
        sound.key ? `data-key="${escapeHtml(sound.key)}"` : '',
        sound.duration != null ? `data-duration="${sound.duration}"` : '',
        sound.tags?.length ? `data-tags="${escapeHtml(sound.tags.join(','))}"` : '',
        sound.peaks ? `data-peaks="${encodePeaks(sound.peaks)}"` : '',
        sound.waveform ? `data-waveform="${escapeHtml(sound.waveform)}"` : '',
        hidden ? 'hidden' : '',
    ].filter(Boolean).join(' ');

    const cols = o.columns.map((c) => {
        if (c === 'type') return `<span class="ws-cell ws-type">${escapeHtml(sound.type)}</span>`;
        if (c === 'bpm') return `<span class="ws-cell ws-bpm">${sound.bpm != null ? escapeHtml(sound.bpm) : ''}</span>`;
        if (c === 'key') return `<span class="ws-cell ws-key">${escapeHtml(sound.key)}</span>`;
        return `<span class="ws-cell ws-duration">${escapeHtml(formatDuration(sound.duration))}</span>`;
    }).join('');

    const wave = o.player === 'inline'
        ? `<span class="ws-wave" role="slider" aria-label="${escapeHtml(fill(s.seek, {title: sound.title}))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="-1"><canvas class="ws-canvas" aria-hidden="true"></canvas></span>`
        : '';

    return `<li ${attrs}>`
        + `<button type="button" class="ws-play" aria-pressed="false" aria-label="${escapeHtml(fill(s.play, {title: sound.title}))}">${ICON_PLAY}${ICON_PAUSE}</button>`
        + `<span class="ws-cell ws-title">${escapeHtml(sound.title)}</span>`
        + cols
        + wave
        + `</li>`;
}

/**
 * The whole component's inner markup.
 *
 * @param {Object[]} sounds - Sounds (normalised or raw; normalised here).
 * @param {Object} [options] - Render options (see `WaveformSoundsOptions`).
 * @returns {string} HTML for the inside of `[data-waveform-sounds]`.
 */
export function renderSounds(sounds, options = {}) {
    const o = resolveRenderOptions(options);
    const list = normalizeSounds(sounds);
    const s = o.strings;
    const f = facets(list);
    const total = list.length;

    const showTypes = o.filters.includes('type') && f.types.length > 1;
    // A pack has a handful of types; a whole library can have fifty. Past
    // `maxTypeChips` the chips would be a wall, so the type is a menu.
    const typeMenu = showTypes && f.types.length > o.maxTypeChips;
    const typeChips = showTypes && !typeMenu;
    const showKey = o.filters.includes('key') && f.keys.length > 1;
    const showBpm = o.filters.includes('bpm') && f.bpm && f.bpm.max > f.bpm.min;

    const parts = [];
    parts.push('<div class="ws-toolbar">');
    if (o.search) {
        parts.push(`<label class="ws-search">${ICON_SEARCH}<span class="ws-sr">${escapeHtml(s.search)}</span>`
            + `<input type="search" class="ws-search-input" data-ws-search placeholder="${escapeHtml(s.searchPlaceholder)}" autocomplete="off" spellcheck="false"></label>`);
    }
    if (typeMenu || showKey || showBpm || o.sortable || o.loopToggle) {
        parts.push('<div class="ws-controls">');
        if (typeMenu) {
            parts.push(`<label class="ws-select"><span class="ws-sr">${escapeHtml(s.types)}</span><select data-ws-type-select>`
                + `<option value="">${escapeHtml(s.allTypes)} (${total})</option>`
                + f.types.map((t) => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)} (${t.count})</option>`).join('')
                + '</select></label>');
        }
        if (showKey) {
            parts.push(`<label class="ws-select"><span class="ws-sr">${escapeHtml(s.key)}</span><select data-ws-key>`
                + `<option value="">${escapeHtml(s.anyKey)}</option>`
                + f.keys.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')
                + '</select></label>');
        }
        if (showBpm) {
            parts.push(`<span class="ws-bpm-range" role="group" aria-label="${escapeHtml(s.bpm)}">`
                + `<input type="number" inputmode="numeric" data-ws-bpm-min aria-label="${escapeHtml(s.bpmMin)}" placeholder="${f.bpm.min}" min="0" step="1">`
                + '<span aria-hidden="true">–</span>'
                + `<input type="number" inputmode="numeric" data-ws-bpm-max aria-label="${escapeHtml(s.bpmMax)}" placeholder="${f.bpm.max}" min="0" step="1">`
                + `<span class="ws-bpm-unit" aria-hidden="true">${escapeHtml(s.bpm)}</span></span>`);
        }
        if (o.sortable) {
            const label = {default: s.sortDefault, title: s.sortTitle, bpm: s.sortBpm, key: s.sortKey, duration: s.sortDuration};
            const usable = SORTS.filter((k) => k === 'default' || k === 'title'
                || (k === 'bpm' && f.bpm) || (k === 'key' && f.keys.length) || (k === 'duration' && f.hasDuration));
            parts.push(`<label class="ws-select"><span class="ws-sr">${escapeHtml(s.sort)}</span><select data-ws-sort>`
                + usable.map((k) => `<option value="${k}">${escapeHtml(label[k])}</option>`).join('')
                + '</select></label>');
        }
        if (o.loopToggle) {
            parts.push(`<button type="button" class="ws-loop" data-ws-loop aria-pressed="false">${ICON_LOOP}<span>${escapeHtml(s.loop)}</span></button>`);
        }
        parts.push('</div>');
    }
    // The chips and the count share one row (the count alone when there
    // are no chips).
    parts.push('<div class="ws-meta">');
    if (typeChips) {
        parts.push(`<div class="ws-types" role="group" aria-label="${escapeHtml(s.types)}">`
            + `<button type="button" class="ws-chip" data-ws-type="" aria-pressed="true">${escapeHtml(s.all)} <span class="ws-chip-count">${total}</span></button>`
            + f.types.map((t) => `<button type="button" class="ws-chip" data-ws-type="${escapeHtml(t.name)}" aria-pressed="false">${escapeHtml(t.name)} <span class="ws-chip-count">${t.count}</span></button>`).join('')
            + '</div>');
    }
    parts.push(`<p class="ws-count" data-ws-count aria-live="polite">${escapeHtml(countText(total, total, s))}</p>`);
    parts.push('</div></div>');

    const page = o.pageSize > 0 ? o.pageSize : Infinity;
    parts.push(`<ul class="ws-list ws-list--${o.player}" role="list" data-ws-list>`
        + list.map((sound, i) => renderRow(sound, i, o, i >= page)).join('')
        + '</ul>');

    const more = total - Math.min(total, page);
    parts.push(`<p class="ws-empty" data-ws-empty hidden>${escapeHtml(s.empty)} <button type="button" class="ws-clear" data-ws-clear>${escapeHtml(s.clear)}</button></p>`);
    parts.push(`<button type="button" class="ws-more" data-ws-more${more > 0 ? '' : ' hidden'}>${escapeHtml(fill(s.showMore, {count: Math.min(more, o.pageSize || more)}))}</button>`);
    parts.push(`<div class="ws-engine${o.player === 'strip' ? ' ws-engine--strip' : ''}" data-ws-engine${o.player === 'strip' ? '' : ' hidden'}></div>`);
    parts.push('<p class="ws-sr" data-ws-status aria-live="polite"></p>');
    return parts.join('');
}

/**
 * The full element, for callers who want one string: the wrapper div with
 * its `data-waveform-sounds` marker, its `data-player` and the inner markup.
 *
 * @param {Object[]} sounds
 * @param {Object} [options]
 * @param {string} [className] - Extra classes for the wrapper.
 * @returns {string}
 */
export function renderSoundsElement(sounds, options = {}, className = '') {
    const o = resolveRenderOptions(options);
    const cls = ['waveform-sounds', `waveform-sounds--${o.player}`, className].filter(Boolean).join(' ');
    return `<div class="${escapeHtml(cls)}" data-waveform-sounds data-player="${o.player}">${renderSounds(sounds, options)}</div>`;
}
