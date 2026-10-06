/**
 * Moving through the list: which row a key lands on, how far an arrow
 * seeks, and which rows the current page shows. Pure — the runtime maps
 * the results onto rows and the engine.
 *
 * @module navigation
 */

import {clamp} from '../shared/utils.js';

/** How far ←/→ seek, as a fraction of the sound. */
export const SEEK_STEP = 0.1;

/**
 * Where a navigation key moves from position `at` in a list of `count`
 * visible rows.
 *
 * @param {string} key - `KeyboardEvent.key`.
 * @param {number} at - The focused row's position among the visible rows.
 * @param {number} count - How many rows are visible.
 * @returns {number|'search'|null} The new position; `'search'` for ↑ on
 *   the first row (back to the search field); null when the key isn't a
 *   move or there is nowhere to go.
 */
export function rowTarget(key, at, count) {
    if (!count) return null;
    switch (key) {
        case 'ArrowDown': return at + 1 < count ? at + 1 : null;
        case 'ArrowUp': return at > 0 ? at - 1 : 'search';
        case 'Home': return 0;
        case 'End': return count - 1;
        default: return null;
    }
}

/**
 * The position an ←/→ press seeks to. Stops just short of the end, so a
 * held → can't end the sound by accident.
 *
 * @param {number} progress - Current position, 0..1.
 * @param {string} key - `'ArrowRight'` or `'ArrowLeft'`.
 * @returns {number|null} The new position, or null for any other key.
 */
export function seekTarget(progress, key) {
    if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null;
    return clamp(progress + (key === 'ArrowRight' ? SEEK_STEP : -SEEK_STEP), 0, 0.999);
}

/**
 * Which of the matching sounds the current page shows, and how many more
 * "Show more" would reveal.
 *
 * @template T
 * @param {T[]} shown - The sounds that match, in display order.
 * @param {number} limit - How many to show (Infinity for all).
 * @returns {{visible: Set<T>, remaining: number}}
 */
export function pageWindow(shown, limit) {
    const visible = new Set(shown.slice(0, limit));
    return {visible, remaining: shown.length - visible.size};
}

/**
 * The page limit that reveals position `pos` (used when playing past the
 * end of the current page, e.g. by `next()` or auto-advance).
 *
 * @param {number} limit - The current limit.
 * @param {number} pos - The position that must be visible.
 * @returns {number}
 */
export function limitToReveal(limit, pos) {
    return pos >= limit ? pos + 1 : limit;
}
