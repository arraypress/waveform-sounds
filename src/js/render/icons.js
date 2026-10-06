/**
 * The list's icons: 24×24 single-path SVGs that take `currentColor`, so
 * they follow whatever colour their control has. Decorative (aria-hidden);
 * every control carries its own label.
 *
 * @module icons
 */

/**
 * One icon.
 *
 * @param {string} path - The SVG path data.
 * @param {string} [extraClass] - Classes beyond `ws-icon`.
 * @returns {string}
 */
function icon(path, extraClass = '') {
    const cls = extraClass ? `ws-icon ${extraClass}` : 'ws-icon';
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
}

export const ICONS = {
    play: icon('M8 5.5v13l11-6.5z', 'ws-icon-play'),
    pause: icon('M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', 'ws-icon-pause'),
    search: icon('M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z'),
    chevron: icon('M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z', 'ws-menu-chevron'),
    check: icon('M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z', 'ws-menu-check'),
    download: icon('M11 4h2v8.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z'),
    loop: icon('M17 4l3 3-3 3V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V4zM7 20l-3-3 3-3v2h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v2z'),
};
