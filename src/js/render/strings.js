/**
 * Every word the list shows or announces, so a site can translate it
 * (`strings` option, or `data-strings` JSON). `{title}`, `{count}` and
 * `{total}` are filled in.
 *
 * @module strings
 */

/** The English defaults. */
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

/** The label each sort order shows in the Sort menu. */
export const SORT_LABEL_KEYS = {
    default: 'sortDefault',
    title: 'sortTitle',
    bpm: 'sortBpm',
    key: 'sortKey',
    duration: 'sortDuration',
};

/**
 * Fill `{name}` placeholders; unknown ones are left as written.
 *
 * @param {string} template
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function fill(template, vars = {}) {
    return String(template).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/**
 * The count line: "300 sounds", "1 sound", "12 of 300 sounds".
 *
 * @param {number} shown - Sounds matching the filter.
 * @param {number} total - All sounds.
 * @param {typeof DEFAULT_STRINGS} [strings]
 * @returns {string}
 */
export function countText(shown, total, strings = DEFAULT_STRINGS) {
    if (shown !== total) return fill(strings.countFiltered, {count: shown, total});
    return total === 1 ? strings.countOne : fill(strings.count, {count: total});
}
