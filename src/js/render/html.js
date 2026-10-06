/**
 * A tiny HTML string builder for the server-safe renderer. Two rules make
 * it safe to use everywhere:
 *
 *   - ATTRIBUTE values are always escaped. `true` writes a bare attribute
 *     (`hidden`, `download`); `false`, `null` and `undefined` leave it out.
 *     ARIA states are strings, so pass `String(bool)` for those.
 *   - CHILDREN are HTML. Text goes through {@link text} first.
 *
 * @module html
 */

import {escapeHtml} from '@arraypress/text';

/** Elements with no closing tag. */
const VOID = new Set(['input', 'br', 'img']);

/**
 * Escape text for use as a child.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function text(value) {
    return escapeHtml(value ?? '');
}

/**
 * Serialise attributes, in the order given.
 *
 * @param {Record<string, string|number|boolean|null|undefined>} map
 * @returns {string} e.g. ` class="ws-row" hidden` (leading space included).
 */
export function attrs(map = {}) {
    let out = '';
    for (const [name, value] of Object.entries(map)) {
        if (value === true) out += ` ${name}`;
        else if (value !== false && value != null) out += ` ${name}="${escapeHtml(value)}"`;
    }
    return out;
}

/**
 * Build an element.
 *
 * @param {string} tag
 * @param {Record<string, string|number|boolean|null|undefined>} [attributes]
 * @param {...(string|false|null|undefined|Array)} children - HTML strings; falsy ones and nested arrays are flattened away.
 * @returns {string}
 */
export function h(tag, attributes = {}, ...children) {
    const open = `<${tag}${attrs(attributes)}>`;
    if (VOID.has(tag)) return open;
    return open + children.flat(Infinity).filter((c) => c != null && c !== false && c !== '').join('') + `</${tag}>`;
}
