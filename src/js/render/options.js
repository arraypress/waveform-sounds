/**
 * The options that shape the markup — the renderer's whole input — with
 * their defaults and validation. DOM-free: the server renderer uses it,
 * and the runtime's option surface (`core/options.js`) builds on it.
 *
 * @module render/options
 */

import {SORTS} from '../data/sounds.js';
import {DEFAULT_STRINGS} from './strings.js';

/** The filter controls a list can offer. */
export const FILTERS = ['type', 'key', 'bpm', 'loop'];

/** The columns a row can show after its title. */
export const COLUMNS = ['type', 'bpm', 'key', 'duration'];

/** The options that shape the markup (the renderer's whole input). */
export const RENDER_DEFAULTS = {
    player: 'inline',
    search: true,
    filters: [...FILTERS],
    sorts: [...SORTS],
    loopToggle: true,
    showCount: true,
    menuSearch: 8,
    pageSize: 50,
    columns: [...COLUMNS],
    maxTypeChips: 10,
};

/**
 * The object without its `undefined` entries (so spreading it can't erase
 * a default).
 *
 * @param {Object|null|undefined} obj
 * @returns {Object}
 */
export function defined(obj) {
    const out = {};
    for (const k in obj ?? {}) if (obj[k] !== undefined) out[k] = obj[k];
    return out;
}

/**
 * The entries of `values` that are allowed, in the caller's order; the
 * fallback when `values` isn't a list.
 *
 * @param {unknown} values
 * @param {string[]} allowed
 * @param {string[]} fallback
 * @returns {string[]}
 */
export function allowedList(values, allowed, fallback) {
    return Array.isArray(values) ? values.filter((v) => allowed.includes(v)) : fallback;
}

/**
 * A whole number ≥ 0, or the fallback.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function wholeNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/**
 * The render options, defaulted and validated: unknown filters, sorts and
 * columns are dropped, counts are whole numbers, `strings` is complete.
 *
 * @param {Object} [options]
 * @returns {typeof RENDER_DEFAULTS & {strings: typeof DEFAULT_STRINGS, idPrefix?: string}}
 */
export function resolveRenderOptions(options = {}) {
    const o = {...RENDER_DEFAULTS, ...defined(options)};
    return {
        ...o,
        player: o.player === 'strip' ? 'strip' : 'inline',
        filters: allowedList(o.filters, FILTERS, RENDER_DEFAULTS.filters),
        sorts: allowedList(o.sorts, SORTS, RENDER_DEFAULTS.sorts),
        columns: allowedList(o.columns, COLUMNS, RENDER_DEFAULTS.columns),
        menuSearch: wholeNumber(o.menuSearch, RENDER_DEFAULTS.menuSearch),
        maxTypeChips: wholeNumber(o.maxTypeChips, RENDER_DEFAULTS.maxTypeChips),
        pageSize: wholeNumber(o.pageSize, RENDER_DEFAULTS.pageSize),
        strings: {...DEFAULT_STRINGS, ...defined(options.strings)},
    };
}
