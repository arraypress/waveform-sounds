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

import {escapeHtml} from '@arraypress/text';
import {encodePeaks, facets, formatDuration, normalizeSounds, SORTS} from './data.js';

export {escapeHtml};

/** UI strings. Every visible or announced word, so a site can translate. */
export const DEFAULT_STRINGS = {
    search: 'Search sounds',
    searchPlaceholder: 'Search sounds…',
    all: 'All',
    types: 'Type',
    key: 'Key',
    anyKey: 'Any key',
    allTypes: 'All types',
    findType: 'Find a type…',
    findKey: 'Find a key…',
    noMatches: 'No matches',
    bpm: 'BPM',
    bpmMin: 'Min BPM',
    bpmMax: 'Max BPM',
    sort: 'Sort',
    sortBy: 'Sort by',
    sortDefault: 'Default',
    sortTitle: 'Name',
    sortBpm: 'BPM',
    sortKey: 'Key',
    sortDuration: 'Length',
    loop: 'Loop',
    play: 'Play {title}',
    pause: 'Pause {title}',
    seek: 'Seek {title}',
    download: 'Download {title}',
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
    sorts: ['default', 'title', 'bpm', 'key', 'duration'],
    loopToggle: true,
    showCount: true,
    menuSearch: 8,
    pageSize: 50,
    columns: ['type', 'bpm', 'key', 'duration'],
    maxTypeChips: 10,
};


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
const ICON_CHEVRON = '<svg class="ws-icon ws-menu-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z"/></svg>';
const ICON_CHECK = '<svg class="ws-icon ws-menu-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>';
const ICON_DOWNLOAD = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 4h2v8.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z"/></svg>';
const ICON_LOOP = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 4l3 3-3 3V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V4zM7 20l-3-3 3-3v2h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v2z"/></svg>';

/**
 * Merge render options with their defaults and validate the enumerations.
 * @param {Object} options
 */
export function resolveRenderOptions(options = {}) {
    const o = {...RENDER_DEFAULTS, ...stripUndefined(options)};
    if (o.player !== 'strip') o.player = 'inline';
    o.filters = Array.isArray(o.filters) ? o.filters.filter((f) => ['type', 'key', 'bpm'].includes(f)) : RENDER_DEFAULTS.filters;
    o.sorts = Array.isArray(o.sorts) ? o.sorts.filter((k) => SORTS.includes(k)) : RENDER_DEFAULTS.sorts;
    o.menuSearch = Number.isFinite(Number(o.menuSearch)) && Number(o.menuSearch) >= 0 ? Math.floor(Number(o.menuSearch)) : RENDER_DEFAULTS.menuSearch;
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
        sound.download ? `data-download="${escapeHtml(sound.download)}"` : '',
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
        // The meta cells share a wrapper: `display: contents` on wide rows
        // (each is a column), one line under the title on narrow ones.
        + (cols ? `<span class="ws-cells">${cols}</span>` : '')
        + wave
        // Optional, per sound: a plain link (a free sample, the .mid of a
        // MIDI preview). Rows without one carry no element at all.
        + (sound.download ? `<a class="ws-download" href="${escapeHtml(sound.download)}" download aria-label="${escapeHtml(fill(s.download, {title: sound.title}))}">${ICON_DOWNLOAD}</a>` : '')
        + `</li>`;
}

/**
 * The sort orders worth offering: the configured ones the data can use
 * (no BPM sort without BPMs). Shared by the renderer and the runtime so
 * the menu and the initial order always agree.
 */
export function availableSorts(sorts, f) {
    return sorts.filter((k) => k === 'default' || k === 'title'
        || (k === 'bpm' && f.bpm) || (k === 'key' && f.keys.length) || (k === 'duration' && f.hasDuration));
}

/** A stable id prefix from the sounds (same on server and client). */
export function idBase(list) {
    let h = 5381;
    const str = list.length + '|' + list.map((x) => x.url).join('|');
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'ws' + (h >>> 0).toString(36);
}

/**
 * A dropdown: a button and a popup listbox, with a search field when it
 * has more than `searchFrom` options. The runtime opens it, filters it and
 * moves through it from the keyboard; the markup is complete without JS
 * (the button shows the current value).
 *
 * @param {string} name - 'type' | 'key' | 'sort' (the runtime routes by it).
 * @param {{label: string, prefix?: string, value: string, options: {value: string, label: string, count?: number}[], searchFrom: number, placeholder?: string, noMatches: string, id: string}} m
 */
export function renderMenu(name, m) {
    const id = `${m.id}-${name}`;
    const current = m.options.find((o) => o.value === m.value) || m.options[0];
    const searchable = m.options.length > m.searchFrom && m.placeholder;
    return `<div class="ws-menu" data-ws-menu="${name}">`
        + `<button type="button" class="ws-menu-btn" data-ws-menu-btn aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list">`
        + (m.prefix ? `<span class="ws-menu-prefix">${escapeHtml(m.prefix)}</span>` : `<span class="ws-sr">${escapeHtml(m.label)}: </span>`)
        + `<span class="ws-menu-value" data-ws-menu-value>${escapeHtml(current.label)}</span>${ICON_CHEVRON}</button>`
        + '<div class="ws-menu-pop" data-ws-menu-pop hidden>'
        + (searchable ? `<input type="search" class="ws-menu-search" data-ws-menu-search role="combobox" aria-expanded="true" aria-controls="${id}-list" aria-autocomplete="list" aria-label="${escapeHtml(m.placeholder)}" placeholder="${escapeHtml(m.placeholder)}" autocomplete="off" spellcheck="false">` : '')
        + `<ul class="ws-menu-list" role="listbox" id="${id}-list" aria-label="${escapeHtml(m.label)}" tabindex="-1" data-ws-menu-list>`
        + m.options.map((o, i) => `<li role="option" id="${id}-${i}" class="ws-menu-option" data-value="${escapeHtml(o.value)}" aria-selected="${o === current}">`
            + `${ICON_CHECK}<span class="ws-menu-text">${escapeHtml(o.label)}</span>`
            + (o.count != null ? `<span class="ws-menu-count">${o.count}</span>` : '') + '</li>').join('')
        + `</ul><p class="ws-menu-none" data-ws-menu-none hidden>${escapeHtml(m.noMatches)}</p></div></div>`;
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
    // A sort order is offered only when the data has something to sort by.
    const sorts = availableSorts(o.sorts, f);
    const showSort = sorts.length > 1;
    // Unique per list: the caller's prefix, else one derived from the sounds
    // (two lists of the SAME sounds on a page need an idPrefix each).
    const id = o.idPrefix || idBase(list);
    const menu = (name, m) => renderMenu(name, {searchFrom: o.menuSearch, noMatches: s.noMatches, id, ...m});

    const parts = [];
    parts.push('<div class="ws-toolbar">');
    if (o.search) {
        parts.push(`<label class="ws-search">${ICON_SEARCH}<span class="ws-sr">${escapeHtml(s.search)}</span>`
            + `<input type="search" class="ws-search-input" data-ws-search placeholder="${escapeHtml(s.searchPlaceholder)}" autocomplete="off" spellcheck="false"></label>`);
    }
    if (typeMenu || showKey || showBpm || showSort || o.loopToggle) {
        parts.push('<div class="ws-controls">');
        if (typeMenu) {
            parts.push(menu('type', {
                label: s.types, value: '', placeholder: s.findType,
                options: [{value: '', label: s.allTypes, count: total}, ...f.types.map((t) => ({value: t.name, label: t.name, count: t.count}))],
            }));
        }
        if (showKey) {
            parts.push(menu('key', {
                label: s.key, value: '', placeholder: s.findKey,
                options: [{value: '', label: s.anyKey}, ...f.keys.map((k) => ({value: k, label: k}))],
            }));
        }
        if (showBpm) {
            parts.push(`<span class="ws-bpm-range" role="group" aria-label="${escapeHtml(s.bpm)}">`
                + `<input type="number" inputmode="numeric" data-ws-bpm-min aria-label="${escapeHtml(s.bpmMin)}" placeholder="${f.bpm.min}" min="0" step="1">`
                + '<span aria-hidden="true">–</span>'
                + `<input type="number" inputmode="numeric" data-ws-bpm-max aria-label="${escapeHtml(s.bpmMax)}" placeholder="${f.bpm.max}" min="0" step="1">`
                + `<span class="ws-bpm-unit" aria-hidden="true">${escapeHtml(s.bpm)}</span></span>`);
        }
        if (showSort) {
            const label = {default: s.sortDefault, title: s.sortTitle, bpm: s.sortBpm, key: s.sortKey, duration: s.sortDuration};
            parts.push(menu('sort', {
                label: s.sort, prefix: s.sortBy, value: sorts[0],
                options: sorts.map((k) => ({value: k, label: label[k]})),
            }));
        }
        if (o.loopToggle) {
            parts.push(`<button type="button" class="ws-loop" data-ws-loop aria-pressed="false">${ICON_LOOP}<span>${escapeHtml(s.loop)}</span></button>`);
        }
        parts.push('</div>');
    }
    // The chips and the count share one row (the count alone when there
    // are no chips).
    if (typeChips || o.showCount) parts.push('<div class="ws-meta">');
    if (typeChips) {
        parts.push(`<div class="ws-types" role="group" aria-label="${escapeHtml(s.types)}">`
            + `<button type="button" class="ws-chip" data-ws-type="" aria-pressed="true"><span class="ws-chip-label">${escapeHtml(s.all)}</span> <span class="ws-chip-count">${total}</span></button>`
            + f.types.map((t) => `<button type="button" class="ws-chip" data-ws-type="${escapeHtml(t.name)}" aria-pressed="false"><span class="ws-chip-label">${escapeHtml(t.name)}</span> <span class="ws-chip-count">${t.count}</span></button>`).join('')
            + '</div>');
    }
    if (o.showCount) parts.push(`<p class="ws-count" data-ws-count aria-live="polite">${escapeHtml(countText(total, total, s))}</p>`);
    if (typeChips || o.showCount) parts.push('</div>');
    parts.push('</div>');

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
