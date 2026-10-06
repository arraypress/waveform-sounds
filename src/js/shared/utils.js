/**
 * Small shared helpers with no state. The pure ones run anywhere; the two
 * that take an element only read from it.
 *
 * @module utils
 */

/** Prefix for every console message and thrown error. */
export const LOG = '[WaveformSounds]';

/**
 * Clamp a number into a range.
 *
 * @param {number} value
 * @param {number} [min=0]
 * @param {number} [max=1]
 * @returns {number}
 */
export function clamp(value, min = 0, max = 1) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Where a pointer sits across a box, as a fraction 0..1 — the seek
 * position of a click on a row waveform.
 *
 * @param {number} clientX - The pointer's x (viewport coordinates).
 * @param {{left: number, width: number}} rect - The box (getBoundingClientRect()).
 * @returns {number} 0..1; 0 for a box with no width.
 */
export function pointerFraction(clientX, rect) {
    return rect && rect.width ? clamp((clientX - rect.left) / rect.width) : 0;
}

/**
 * Is the element a place the user types into? Keyboard shortcuts (`/`)
 * must not fire there.
 *
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isTyping(el) {
    return !!el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
}

/**
 * Dispatch a bubbling `waveformsounds:<name>` CustomEvent from an element.
 * Every event the list emits goes through here, so they share one shape:
 * the detail plus the instance that sent it.
 *
 * @param {EventTarget} target
 * @param {string} name - Without the prefix (`'play'`).
 * @param {Object} detail
 * @returns {CustomEvent} The event dispatched.
 */
export function emit(target, name, detail) {
    const event = new CustomEvent(`waveformsounds:${name}`, {bubbles: true, detail});
    target.dispatchEvent(event);
    return event;
}

/**
 * A small, stable string hash (djb2, 32-bit) — for ids that must come out
 * the same on the server and in the browser. Not cryptographic.
 *
 * @param {string} str
 * @returns {number} An unsigned 32-bit integer.
 */
export function hashString(str) {
    let hash = 5381;
    for (const char of str) hash = (hash * 33 + char.codePointAt(0)) >>> 0;
    return hash;
}
