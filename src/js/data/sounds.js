import {fold, matchesAll, words} from '@arraypress/text';

/**
 * Pure data helpers: no DOM, no window. Shared by the browser runtime and
 * the server renderer (`@arraypress/waveform-sounds/render`), so a wrapper
 * that renders the list on the server produces exactly what the client
 * would.
 *
 * @module data
 */

/**
 * Peaks travel as an 8-bit hex string, two characters per bar ("00"–"ff").
 * A sound browser draws ~48–64 bars per row, so that is ~100 characters a
 * sound: 300 sounds is ~30 KB in a manifest or in row attributes, against
 * ~3x that as a JSON number array.
 *
 * @param {number[]} peaks - Values 0..1.
 * @returns {string} Hex string.
 */
export function encodePeaks(peaks) {
    if (!Array.isArray(peaks)) return '';
    let out = '';
    for (const p of peaks) {
        const v = Math.round(Math.min(Math.max(Number(p) || 0, 0), 1) * 255);
        out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
}

/**
 * Decode peaks from any accepted form into numbers 0..1.
 *
 * Accepts the hex string from {@link encodePeaks}, an array of 0..1
 * numbers, or an array of integers on a larger scale (e.g. 0..100 or
 * 0..255) together with that `scale`.
 *
 * @param {string|number[]|null|undefined} value
 * @param {number} [scale=1] - The maximum of an integer array.
 * @returns {number[]|null} Peaks, or null when there are none.
 */
export function decodePeaks(value, scale = 1) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
        if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
        const out = new Array(value.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(value.substr(i * 2, 2), 16) / 255;
        return out;
    }
    if (!Array.isArray(value)) return null;
    const s = Number(scale) > 0 ? Number(scale) : 1;
    const out = value.map((v) => Math.min(Math.max((Number(v) || 0) / s, 0), 1));
    return out.length ? out : null;
}

/**
 * Normalise a musical key to a short canonical form: root, accidental
 * (`#` or `b`), and `m` for minor. "F minor", "Fmin", "f m" → "Fm";
 * "C# Major", "C♯" → "C#". Anything unparseable comes back trimmed, as
 * given, so an unusual label still displays.
 *
 * @param {string|null|undefined} key
 * @returns {string} Canonical key, or '' for none.
 */
export function normalizeKey(key) {
    if (key == null) return '';
    const raw = String(key).trim();
    const m = raw.match(/^([A-Ga-g])[\s_-]*([#♯b♭]?)[\s_-]*(m|min|minor|maj|major)?$/i);
    if (!m) return raw;
    const root = m[1].toUpperCase();
    const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2];
    const minor = m[3] && /^m(in(or)?)?$/i.test(m[3]) && m[3] !== 'M';
    return root + acc + (minor ? 'm' : '');
}

/** Pitch class of each root, for sorting keys: C, C#, D … B, majors before minors. */
const KEY_PITCH = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};

/** Sort rank of a canonical key; unknown keys sort last. */
function keyRank(key) {
    if (!key) return Infinity;
    const minor = key.endsWith('m');
    const root = minor ? key.slice(0, -1) : key;
    const p = KEY_PITCH[root];
    return p === undefined ? 1000 : p * 2 + (minor ? 1 : 0);
}

/**
 * Format seconds as m:ss, or as tenths under a second.
 *
 * A one-shot (a kick, a hat) is often shorter than a second, and m:ss would
 * round it to "0:00", which reads as a missing length.
 *
 * @param {number|null|undefined} seconds
 * @returns {string} e.g. "0:08", "0.4s", or '' when unknown.
 */
export function formatDuration(seconds) {
    // Number(null) is 0: an unknown length must not render as "0:00".
    if (seconds == null || seconds === '') return '';
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) return '';
    // Anything that would round to "1.0s" is shown as "0:01" instead.
    if (s > 0 && s < 0.95) return `${Math.max(0.1, Math.round(s * 10) / 10).toFixed(1)}s`;
    const total = Math.round(s);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Parse a duration given as seconds (8.02) or as "m:ss" / "h:mm:ss".
 * @param {number|string|null|undefined} value
 * @returns {number|null}
 */
export function parseDuration(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    const str = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
    const parts = str.split(':').map(Number);
    if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * The title a file name implies: extension and separators dropped,
 * leading pack prefixes kept (they are often the label's code).
 * "NW_Bass_Loop_04_128_Fmin.wav" → "NW Bass Loop 04 128 Fmin".
 * @param {string} url
 * @returns {string}
 */
export function titleFromUrl(url) {
    const file = String(url || '').split(/[?#]/)[0].split('/').pop() || '';
    let name = file.replace(/\.[a-z0-9]+$/i, '');
    try { name = decodeURIComponent(name); } catch { /* keep as is */ }
    return name.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Normalise one sound into the shape the runtime and renderer use.
 *
 * @param {Object} input - A sound: `{url, title?, type?, bpm?, key?,
 *   duration?, tags?, peaks?, waveform?, id?}`.
 * @param {number} index - Its position (used for a fallback id).
 * @param {number} [peakScale=1] - Scale of an integer `peaks` array.
 * @returns {import('../../../index').Sound|null} The sound, or null if it has
 *   no url.
 */
export function normalizeSound(input, index, peakScale = 1) {
    if (!input || typeof input !== 'object' || !input.url) return null;
    const bpm = Number(input.bpm);
    const tags = Array.isArray(input.tags)
        ? input.tags.map((t) => String(t).trim()).filter(Boolean)
        : typeof input.tags === 'string'
            ? input.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [];
    return {
        id: input.id != null && input.id !== '' ? String(input.id) : `sound-${index + 1}`,
        url: String(input.url),
        title: input.title ? String(input.title) : titleFromUrl(input.url),
        type: input.type ? String(input.type) : '',
        bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm * 100) / 100 : null,
        key: normalizeKey(input.key),
        duration: parseDuration(input.duration),
        tags,
        peaks: decodePeaks(input.peaks, peakScale),
        waveform: input.waveform ? String(input.waveform) : null,
        download: input.download ? String(input.download) : null,
    };
}

/**
 * Read a sounds manifest. Accepts `{version, peakScale?, sounds: [...]}`
 * (what `waveform-gen --manifest` writes) or a bare array of sounds.
 * Sounds without a url are dropped.
 *
 * @param {Object|Array} manifest
 * @returns {import('../../../index').Sound[]}
 */
export function parseManifest(manifest) {
    const list = Array.isArray(manifest) ? manifest : Array.isArray(manifest?.sounds) ? manifest.sounds : [];
    const scale = Array.isArray(manifest) ? 1 : Number(manifest?.peakScale) || 1;
    return normalizeSounds(list, scale);
}

/**
 * Normalise a list of sounds, dropping invalid ones and de-duplicating ids
 * (a repeated id would make two rows answer to one play() call).
 * @param {Array} list
 * @param {number} [peakScale=1]
 * @returns {import('../../../index').Sound[]}
 */
export function normalizeSounds(list, peakScale = 1) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((item, i) => {
        const s = normalizeSound(item, i, peakScale);
        if (!s) return;
        let id = s.id, n = 2;
        while (seen.has(id)) id = `${s.id}-${n++}`;
        s.id = id;
        seen.add(id);
        out.push(s);
    });
    return out;
}

/**
 * What the filter controls offer, derived from the sounds: each type with
 * its count (in first-seen order), each key (in musical order), and the
 * BPM range. A control with nothing to offer is not rendered.
 *
 * @param {import('../../../index').Sound[]} sounds
 * @returns {{types: {name: string, count: number}[], keys: string[], bpm: {min: number, max: number}|null, hasDuration: boolean}}
 */
export function facets(sounds) {
    const types = new Map();
    const keys = new Set();
    let min = Infinity, max = -Infinity, hasDuration = false;
    for (const s of sounds) {
        if (s.type) types.set(s.type, (types.get(s.type) || 0) + 1);
        if (s.key) keys.add(s.key);
        if (s.bpm != null) { min = Math.min(min, s.bpm); max = Math.max(max, s.bpm); }
        if (s.duration != null) hasDuration = true;
    }
    return {
        types: [...types].map(([name, count]) => ({name, count})),
        keys: [...keys].sort((a, b) => keyRank(a) - keyRank(b) || a.localeCompare(b)),
        bpm: min === Infinity ? null : {min, max},
        hasDuration,
    };
}

/**
 * Does a sound match the filter? Every set criterion must hold.
 *
 * `query` matches the title, type, key and tags with
 * `@arraypress/text`'s `matchesAll`: every word, in any order, forgiving
 * one typo in words of four letters or more ("drun" finds drum loops). A
 * number in the query also matches the BPM exactly, so "bass 128" finds
 * 128 BPM bass loops.
 *
 * @param {import('../../../index').Sound} sound
 * @param {import('../../../index').SoundsFilter} filter
 * @returns {boolean}
 */
export function matches(sound, filter = {}) {
    if (filter.type && sound.type !== filter.type) return false;
    if (filter.key && sound.key !== normalizeKey(filter.key)) return false;
    const lo = Number(filter.bpmMin), hi = Number(filter.bpmMax);
    if ((filter.bpmMin != null && filter.bpmMin !== '' && Number.isFinite(lo)) ||
        (filter.bpmMax != null && filter.bpmMax !== '' && Number.isFinite(hi))) {
        if (sound.bpm == null) return false;
        if (filter.bpmMin != null && filter.bpmMin !== '' && sound.bpm < lo) return false;
        if (filter.bpmMax != null && filter.bpmMax !== '' && sound.bpm > hi) return false;
    }
    const terms = words(filter.query || '');
    if (terms.length) {
        const hay = [sound.title, sound.type, sound.key, ...(sound.tags || [])].join(' ');
        const folded = fold(hay);
        // A number naming this sound's BPM is satisfied; the rest is text.
        const rest = terms.filter((w) => !(/^\d+$/.test(w) && !folded.includes(w)
            && sound.bpm != null && Math.round(sound.bpm) === Number(w)));
        if (rest.length && !matchesAll(hay, rest.join(' '))) return false;
    }
    return true;
}

/** The sort orders the toolbar offers. */
export const SORTS = ['default', 'title', 'bpm', 'key', 'duration'];

/** What each sort order needs from the data before it's worth offering. */
const SORT_NEEDS = {
    default: () => true,
    title: () => true,
    bpm: (f) => f.bpm !== null,
    key: (f) => f.keys.length > 0,
    duration: (f) => f.hasDuration,
};

/**
 * The configured sort orders the data can use (no BPM sort without BPMs),
 * in the configured order. Shared by the renderer and the runtime, so the
 * menu and the starting order always agree.
 *
 * @param {string[]} sorts - The configured orders.
 * @param {ReturnType<typeof facets>} f - The sounds' facets.
 * @returns {string[]}
 */
export function availableSorts(sorts, f) {
    return sorts.filter((sort) => SORT_NEEDS[sort]?.(f));
}

/**
 * Sort sounds (returns a new array; `default` keeps the given order).
 * Missing values sort last in every order.
 *
 * @param {import('../../../index').Sound[]} sounds
 * @param {string} [by='default']
 * @returns {import('../../../index').Sound[]}
 */
export function sortSounds(sounds, by = 'default') {
    const list = sounds.map((s, i) => ({s, i}));
    const last = (v) => (v == null ? Infinity : v);
    const cmp = {
        title: (a, b) => a.s.title.localeCompare(b.s.title, undefined, {numeric: true, sensitivity: 'base'}),
        bpm: (a, b) => last(a.s.bpm) - last(b.s.bpm),
        key: (a, b) => keyRank(a.s.key) - keyRank(b.s.key),
        duration: (a, b) => last(a.s.duration) - last(b.s.duration),
    }[by];
    if (cmp) list.sort((a, b) => cmp(a, b) || a.i - b.i);
    return list.map((x) => x.s);
}

