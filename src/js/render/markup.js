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
 * `data-ws-*` attribute here is read by the runtime (`core.js`,
 * `menus.js`, `rows.js`).
 *
 * @module render
 */

import {escapeHtml} from '@arraypress/text';
import {availableSorts, encodePeaks, facets, formatDuration, normalizeSounds} from '../data/sounds.js';
import {h, text} from './html.js';
import {ICONS} from './icons.js';
import {RENDER_DEFAULTS, resolveRenderOptions} from './options.js';
import {countText, DEFAULT_STRINGS, fill, SORT_LABEL_KEYS} from './strings.js';
import {hashString} from '../shared/utils.js';

export {escapeHtml, RENDER_DEFAULTS, resolveRenderOptions, DEFAULT_STRINGS, countText, fill, availableSorts};

/**
 * A stable id prefix for a list's dropdowns, from its sounds: the same on
 * the server and in the browser. Two lists of the SAME sounds on one page
 * collide, so they need an `idPrefix` each.
 *
 * @param {{url: string}[]} sounds
 * @returns {string} e.g. `ws1x9k2f`.
 */
export function idBase(sounds) {
    const signature = [sounds.length, ...sounds.map((s) => s.url)].join('|');
    return `ws${hashString(signature).toString(36)}`;
}

/**
 * Which controls the toolbar shows. Each appears only when it's enabled
 * AND the data gives it something to do: no type filter for one type, no
 * key menu for one key, no BPM range without a spread of BPMs, no sort
 * menu with one usable order. Types past `maxTypeChips` become a menu (a
 * pack has a handful; a whole library can have fifty).
 *
 * @param {ReturnType<typeof facets>} f - The sounds' facets.
 * @param {ReturnType<typeof resolveRenderOptions>} o - Resolved options.
 * @returns {{types: 'chips'|'menu'|null, key: boolean, bpm: boolean, sorts: string[], search: boolean, loop: boolean, count: boolean}}
 */
export function toolbarPlan(f, o) {
    const typed = o.filters.includes('type') && f.types.length > 1;
    const sorts = availableSorts(o.sorts, f);
    return {
        types: !typed ? null : f.types.length > o.maxTypeChips ? 'menu' : 'chips',
        key: o.filters.includes('key') && f.keys.length > 1,
        bpm: o.filters.includes('bpm') && f.bpm !== null && f.bpm.max > f.bpm.min,
        sorts: sorts.length > 1 ? sorts : [],
        search: !!o.search,
        loop: !!o.loopToggle,
        count: !!o.showCount,
    };
}

/* ── Controls ───────────────────────────────────────────────────────── */

/** The search field. */
function renderSearch(s) {
    return h('label', {class: 'ws-search'},
        ICONS.search,
        h('span', {class: 'ws-sr'}, text(s.search)),
        h('input', {type: 'search', class: 'ws-search-input', 'data-ws-search': true, placeholder: s.searchPlaceholder, autocomplete: 'off', spellcheck: 'false'}),
    );
}

/**
 * A dropdown: a button and a popup listbox, with a search field when it
 * has more than `searchFrom` options. The runtime (`menus.js`) opens,
 * filters and navigates it; without JS the button still shows the value.
 *
 * @param {string} name - 'type' | 'key' | 'sort' (the runtime routes by it).
 * @param {Object} m
 * @param {string} m.id - Id prefix for this list.
 * @param {string} m.label - Accessible name ("Type").
 * @param {string} [m.prefix] - Visible lead-in ("Sort by"); otherwise the label is screen-reader only.
 * @param {string} m.value - The selected value.
 * @param {{value: string, label: string, count?: number}[]} m.options
 * @param {number} m.searchFrom - Options above which a search field is added.
 * @param {string} [m.placeholder] - The search field's placeholder (no field without one).
 * @param {string} m.noMatches - Shown when the search matches nothing.
 * @returns {string}
 */
export function renderMenu(name, m) {
    const listId = `${m.id}-${name}-list`;
    const current = m.options.find((o) => o.value === m.value) ?? m.options[0];
    const searchable = m.placeholder && m.options.length > m.searchFrom;

    const button = h('button', {type: 'button', class: 'ws-menu-btn', 'data-ws-menu-btn': true, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': listId},
        m.prefix
            ? h('span', {class: 'ws-menu-prefix'}, text(m.prefix))
            : h('span', {class: 'ws-sr'}, text(`${m.label}: `)),
        h('span', {class: 'ws-menu-value', 'data-ws-menu-value': true}, text(current.label)),
        ICONS.chevron,
    );
    const search = searchable && h('input', {
        type: 'search', class: 'ws-menu-search', 'data-ws-menu-search': true, role: 'combobox',
        'aria-expanded': 'true', 'aria-controls': listId, 'aria-autocomplete': 'list',
        'aria-label': m.placeholder, placeholder: m.placeholder, autocomplete: 'off', spellcheck: 'false',
    });
    const options = m.options.map((o, i) => h('li', {role: 'option', id: `${m.id}-${name}-${i}`, class: 'ws-menu-option', 'data-value': o.value, 'aria-selected': String(o === current)},
        ICONS.check,
        h('span', {class: 'ws-menu-text'}, text(o.label)),
        o.count != null && h('span', {class: 'ws-menu-count'}, text(o.count)),
    ));

    return h('div', {class: 'ws-menu', 'data-ws-menu': name},
        button,
        h('div', {class: 'ws-menu-pop', 'data-ws-menu-pop': true, hidden: true},
            search,
            h('ul', {class: 'ws-menu-list', role: 'listbox', id: listId, 'aria-label': m.label, tabindex: '-1', 'data-ws-menu-list': true}, options),
            h('p', {class: 'ws-menu-none', 'data-ws-menu-none': true, hidden: true}, text(m.noMatches)),
        ),
    );
}

/** The BPM range: two number fields, with the data's range as placeholders. */
function renderBpmRange(s, range) {
    const field = (attr, label, placeholder) => h('input', {type: 'number', inputmode: 'numeric', [attr]: true, 'aria-label': label, placeholder, min: '0', step: '1'});
    return h('span', {class: 'ws-bpm-range', role: 'group', 'aria-label': s.bpm},
        field('data-ws-bpm-min', s.bpmMin, range.min),
        h('span', {'aria-hidden': 'true'}, '–'),
        field('data-ws-bpm-max', s.bpmMax, range.max),
        h('span', {class: 'ws-bpm-unit', 'aria-hidden': 'true'}, text(s.bpm)),
    );
}

/** The Loop toggle. */
function renderLoopToggle(s) {
    return h('button', {type: 'button', class: 'ws-loop', 'data-ws-loop': true, 'aria-pressed': 'false'}, ICONS.loop, h('span', {}, text(s.loop)));
}

/** One type chip ('' = all). */
function renderChip(value, label, count, pressed) {
    return h('button', {type: 'button', class: 'ws-chip', 'data-ws-type': value, 'aria-pressed': String(pressed)},
        h('span', {class: 'ws-chip-label'}, text(label)), ' ', h('span', {class: 'ws-chip-count'}, text(count)));
}

/**
 * The toolbar: search, the controls row (type menu, key menu, BPM range,
 * sort menu, Loop) and the meta row (type chips + the count).
 *
 * @param {ReturnType<typeof toolbarPlan>} plan
 * @param {Object} ctx - `{o, s, f, total, id}` from {@link renderSounds}.
 * @returns {string}
 */
function renderToolbar(plan, {o, s, f, total, id}) {
    const menu = (name, m) => renderMenu(name, {id, searchFrom: o.menuSearch, noMatches: s.noMatches, ...m});
    const controls = [
        plan.types === 'menu' && menu('type', {
            label: s.types, value: '', placeholder: s.findType,
            options: [{value: '', label: s.allTypes, count: total}, ...f.types.map((t) => ({value: t.name, label: t.name, count: t.count}))],
        }),
        plan.key && menu('key', {
            label: s.key, value: '', placeholder: s.findKey,
            options: [{value: '', label: s.anyKey}, ...f.keys.map((k) => ({value: k, label: k}))],
        }),
        plan.bpm && renderBpmRange(s, f.bpm),
        plan.sorts.length > 0 && menu('sort', {
            label: s.sort, prefix: s.sortBy, value: plan.sorts[0],
            options: plan.sorts.map((k) => ({value: k, label: s[SORT_LABEL_KEYS[k]]})),
        }),
        plan.loop && renderLoopToggle(s),
    ].filter(Boolean);

    const chips = plan.types === 'chips' && h('div', {class: 'ws-types', role: 'group', 'aria-label': s.types},
        renderChip('', s.all, total, true),
        f.types.map((t) => renderChip(t.name, t.name, t.count, false)),
    );
    const count = plan.count && h('p', {class: 'ws-count', 'data-ws-count': true, 'aria-live': 'polite'}, text(countText(total, total, s)));

    return h('div', {class: 'ws-toolbar'},
        plan.search && renderSearch(s),
        controls.length > 0 && h('div', {class: 'ws-controls'}, controls),
        // The chips and the count share a row (the count alone without chips).
        (chips || count) && h('div', {class: 'ws-meta'}, chips, count),
    );
}

/* ── Rows ───────────────────────────────────────────────────────────── */

/** The cells a column shows for a sound. */
const CELLS = {
    type: (sound) => text(sound.type),
    bpm: (sound) => text(sound.bpm ?? ''),
    key: (sound) => text(sound.key),
    duration: (sound) => text(formatDuration(sound.duration)),
};

/**
 * One row. `index` is the sound's position in the ORIGINAL list: the
 * runtime maps rows back to sounds through it, whatever order they are
 * sorted into. Every field is also written as a `data-*` attribute, so the
 * runtime can rebuild the sounds from server markup.
 *
 * @param {import('../../../index').Sound} sound - Normalised.
 * @param {number} index
 * @param {ReturnType<typeof resolveRenderOptions>} o
 * @param {boolean} [hidden] - Past the first page.
 * @returns {string}
 */
export function renderRow(sound, index, o, hidden = false) {
    const s = o.strings;
    const vars = {title: sound.title};
    const cells = o.columns.map((c) => h('span', {class: `ws-cell ws-${c}`}, CELLS[c](sound)));

    return h('li', {
        class: 'ws-row',
        'data-ws-index': index,
        'data-ws-id': sound.id,
        'data-url': sound.url,
        'data-title': sound.title,
        'data-type': sound.type || null,
        'data-bpm': sound.bpm,
        'data-key': sound.key || null,
        'data-duration': sound.duration,
        'data-tags': sound.tags?.length ? sound.tags.join(',') : null,
        'data-peaks': sound.peaks ? encodePeaks(sound.peaks) : null,
        'data-waveform': sound.waveform,
        'data-download': sound.download,
        hidden,
    },
        h('button', {type: 'button', class: 'ws-play', 'aria-pressed': 'false', 'aria-label': fill(s.play, vars)}, ICONS.play, ICONS.pause),
        h('span', {class: 'ws-cell ws-title'}, text(sound.title)),
        // Wide rows: `display: contents` makes each cell a column. Narrow
        // rows: one line under the title.
        cells.length > 0 && h('span', {class: 'ws-cells'}, cells),
        o.player === 'inline' && h('span', {class: 'ws-wave', role: 'slider', 'aria-label': fill(s.seek, vars), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', tabindex: '-1'},
            h('canvas', {class: 'ws-canvas', 'aria-hidden': 'true'})),
        // Optional, per sound: a plain link. Rows without one carry nothing.
        sound.download && h('a', {class: 'ws-download', href: sound.download, download: true, 'aria-label': fill(s.download, vars)}, ICONS.download),
    );
}

/* ── The whole list ─────────────────────────────────────────────────── */

/**
 * What follows the rows: the empty state, "Show more", the engine's slot
 * (visible only in the strip layout) and a live region for announcements.
 */
function renderFooter({o, s, total}) {
    const page = o.pageSize > 0 ? o.pageSize : total;
    const more = Math.max(0, total - page);
    const strip = o.player === 'strip';
    return [
        h('p', {class: 'ws-empty', 'data-ws-empty': true, hidden: true}, text(s.empty), ' ',
            h('button', {type: 'button', class: 'ws-clear', 'data-ws-clear': true}, text(s.clear))),
        h('button', {type: 'button', class: 'ws-more', 'data-ws-more': true, hidden: more === 0}, text(fill(s.showMore, {count: Math.min(more, page)}))),
        h('div', {class: strip ? 'ws-engine ws-engine--strip' : 'ws-engine', 'data-ws-engine': true, hidden: !strip}),
        h('p', {class: 'ws-sr', 'data-ws-status': true, 'aria-live': 'polite'}),
    ].join('');
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
    const ctx = {o, s: o.strings, f: facets(list), total: list.length, id: o.idPrefix || idBase(list)};
    const page = o.pageSize > 0 ? o.pageSize : Infinity;
    return renderToolbar(toolbarPlan(ctx.f, o), ctx)
        + h('ul', {class: `ws-list ws-list--${o.player}`, role: 'list', 'data-ws-list': true},
            list.map((sound, i) => renderRow(sound, i, o, i >= page)))
        + renderFooter(ctx);
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
    return h('div', {class: cls, 'data-waveform-sounds': true, 'data-player': o.player}, renderSounds(sounds, options));
}
