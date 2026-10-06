/**
 * The rows in the DOM: reading server-rendered rows back into sounds, and
 * finding a row by the sound it shows.
 *
 * @module rows
 */

import {normalizeSound} from '../data/sounds.js';

/** A list's row elements, in DOM order. */
const ROW = ':scope > [data-ws-index]';

/**
 * Read server-rendered rows back into sounds. Rows are taken in their
 * original order (`data-ws-index`) and renumbered 0..n-1, and a row whose
 * data is unusable (no url) is removed — so a row missing from the markup
 * can't leave a hole that would misalign rows and sounds.
 *
 * @param {HTMLElement} list - The `[data-ws-list]` element.
 * @returns {import('../../../index').Sound[]}
 */
export function readRows(list) {
    const rows = [...list.querySelectorAll(ROW)]
        .sort((a, b) => Number(a.dataset.wsIndex) - Number(b.dataset.wsIndex));
    const sounds = [];
    for (const row of rows) {
        const d = row.dataset;
        const sound = normalizeSound({
            id: d.wsId, url: d.url, title: d.title, type: d.type, bpm: d.bpm, key: d.key,
            duration: d.duration, tags: d.tags, peaks: d.peaks, waveform: d.waveform, download: d.download,
        }, sounds.length);
        if (!sound) { row.remove(); continue; }
        row.dataset.wsIndex = String(sounds.length);
        sounds.push(sound);
    }
    return sounds;
}

/**
 * The row elements, indexed by the sound each one shows (whatever order
 * they're displayed in).
 *
 * @param {HTMLElement} list
 * @returns {HTMLElement[]}
 */
export function indexRows(list) {
    const rows = [];
    list.querySelectorAll(ROW).forEach((row) => { rows[Number(row.dataset.wsIndex)] = row; });
    return rows;
}

/**
 * The rows currently visible (not hidden by the filter or the page), in
 * display order.
 *
 * @param {HTMLElement} list
 * @returns {HTMLElement[]}
 */
export function visibleRows(list) {
    return [...list.querySelectorAll(ROW)].filter((r) => !r.hidden);
}

/**
 * Put the rows in the given order. Every row moves (hidden ones too), so
 * clearing a filter keeps the order.
 *
 * @param {HTMLElement} list
 * @param {HTMLElement[]} rows - In the order to show them.
 */
export function orderRows(list, rows) {
    const frag = document.createDocumentFragment();
    for (const row of rows) if (row) frag.appendChild(row);
    list.appendChild(frag);
}
