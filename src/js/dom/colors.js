/**
 * Colours the CSS can't hand the runtime directly: the canvas needs real
 * colour values (it can't read `var()` or `color-mix()`), and the inverted
 * "on" states need the page surface behind the list.
 *
 * @module colors
 */

/**
 * The alpha of a computed colour string: `rgba(0, 0, 0, 0)`,
 * `rgb(1 2 3 / 50%)`, `oklab(… / 0.9)`, `transparent`. Opaque when no alpha
 * is written.
 *
 * @param {string|null|undefined} color
 * @returns {number} 0..1.
 */
export function parseAlpha(color) {
    const c = String(color ?? '').trim();
    if (!c || c === 'transparent') return 0;
    const slash = c.match(/\/\s*([\d.]+)(%?)\s*\)$/);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const rgba = c.match(/^rgba\(\s*[^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
    if (rgba) return Number(rgba[1]);
    return 1;
}

/**
 * The first (near-)opaque background at or above an element — the page
 * surface the list sits on. Crosses shadow-root boundaries.
 *
 * @param {Element} el
 * @param {number} [minAlpha=0.95] - How opaque counts as "the surface".
 * @returns {string} A computed colour, or `#fff` when nothing is painted.
 */
export function pageSurface(el, minAlpha = 0.95) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement || node.getRootNode?.().host) {
        const bg = getComputedStyle(node).backgroundColor;
        if (parseAlpha(bg) > minAlpha) return bg;
    }
    return '#fff';
}

/**
 * Resolve any CSS colour (a `var()`, `color-mix()`, `currentColor`) to a
 * concrete value, as it would compute inside `container`.
 *
 * @param {Element} container
 * @param {string} value - A CSS colour expression.
 * @returns {string} The computed colour.
 */
export function resolveCssColor(container, value) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    probe.style.color = value;
    container.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
}
