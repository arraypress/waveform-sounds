// @vitest-environment node
// The data helpers run on the server too (the render entry), so they are
// tested with no DOM at all.
import {describe, it, expect} from 'vitest';
import {
    encodePeaks, decodePeaks, normalizeKey, parseDuration, formatDuration, titleFromUrl,
    normalizeSounds, parseManifest, facets, matches, sortSounds,
} from '../src/js/data.js';

describe('peaks codec', () => {
    it('round-trips 0..1 peaks through 8-bit hex', () => {
        const peaks = [0, 0.25, 0.5, 1];
        const hex = encodePeaks(peaks);
        expect(hex).toBe('004080ff');
        const back = decodePeaks(hex);
        back.forEach((v, i) => expect(v).toBeCloseTo(peaks[i], 2));
    });
    it('clamps out-of-range values and tolerates junk', () => {
        expect(encodePeaks([-1, 2, 'x'])).toBe('00ff00');
        expect(encodePeaks(null)).toBe('');
    });
    it('rejects malformed hex, accepts scaled integer arrays', () => {
        expect(decodePeaks('abc')).toBeNull();
        expect(decodePeaks('zz')).toBeNull();
        expect(decodePeaks('')).toBeNull();
        expect(decodePeaks([0, 50, 100], 100)).toEqual([0, 0.5, 1]);
        expect(decodePeaks([])).toBeNull();
    });
});

describe('normalizeKey', () => {
    it.each([
        ['F minor', 'Fm'], ['Fmin', 'Fm'], ['f m', 'Fm'], ['F Minor', 'Fm'], ['Fm', 'Fm'],
        ['C# Major', 'C#'], ['C♯', 'C#'], ['Bb', 'Bb'], ['B♭m', 'Bbm'], ['A', 'A'], ['FMaj', 'F'],
    ])('%s → %s', (input, out) => expect(normalizeKey(input)).toBe(out));
    it('keeps an unparseable label as given', () => {
        expect(normalizeKey(' Various ')).toBe('Various');
        expect(normalizeKey(null)).toBe('');
    });
});

describe('durations and titles', () => {
    it('parses seconds and m:ss', () => {
        expect(parseDuration(8.5)).toBe(8.5);
        expect(parseDuration('8')).toBe(8);
        expect(parseDuration('0:08')).toBe(8);
        expect(parseDuration('1:02:03')).toBe(3723);
        expect(parseDuration('soon')).toBeNull();
        expect(parseDuration(-1)).toBeNull();
    });
    it('formats m:ss', () => {
        expect(formatDuration(8.4)).toBe('0:08');
        expect(formatDuration(75)).toBe('1:15');
        expect(formatDuration(null)).toBe('');
    });
    it('derives a title from a file name', () => {
        expect(titleFromUrl('/a/NW_Bass_Loop_04_128_Fmin.wav?v=2')).toBe('NW Bass Loop 04 128 Fmin');
        expect(titleFromUrl('/a/Kick%20One.mp3')).toBe('Kick One');
    });
});

describe('normalizeSounds / parseManifest', () => {
    it('drops sounds without a url and de-duplicates ids', () => {
        const list = normalizeSounds([{url: 'a.mp3', id: 'x'}, {title: 'no url'}, {url: 'b.mp3', id: 'x'}, {url: 'c.mp3'}]);
        expect(list.map((s) => s.id)).toEqual(['x', 'x-2', 'sound-4']);
    });
    it('normalises fields', () => {
        const [s] = normalizeSounds([{url: 'a.mp3', bpm: '128', key: 'F minor', duration: '0:08', tags: 'dark, wide', peaks: '00ff'}]);
        expect(s).toMatchObject({bpm: 128, key: 'Fm', duration: 8, tags: ['dark', 'wide'], title: 'a'});
        expect(s.peaks).toEqual([0, 1]);
    });
    it('reads a manifest object or a bare array, honouring peakScale', () => {
        expect(parseManifest({version: 1, peakScale: 100, sounds: [{url: 'a.mp3', peaks: [0, 100]}]})[0].peaks).toEqual([0, 1]);
        expect(parseManifest([{url: 'a.mp3'}])).toHaveLength(1);
        expect(parseManifest(null)).toEqual([]);
    });
});

const SOUNDS = normalizeSounds([
    {url: '1.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm', duration: 8, tags: ['reese']},
    {url: '2.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140, duration: 4},
    {url: '3.mp3', title: 'Bass Loop 02', type: 'Bass', bpm: 124, key: 'C', duration: 16},
    {url: '4.mp3', title: 'Crash', type: 'One-shots'},
]);

describe('facets', () => {
    it('lists types with counts, keys in musical order and the BPM range', () => {
        const f = facets(SOUNDS);
        expect(f.types).toEqual([{name: 'Bass', count: 2}, {name: 'Drums', count: 1}, {name: 'One-shots', count: 1}]);
        expect(f.keys).toEqual(['C', 'Fm']);
        expect(f.bpm).toEqual({min: 124, max: 140});
        expect(f.hasDuration).toBe(true);
    });
});

describe('matches', () => {
    const ids = (filter) => SOUNDS.filter((s) => matches(s, filter)).map((s) => s.url);
    it('needs every word, in any order, across title/type/key/tags', () => {
        expect(ids({query: 'loop bass'})).toEqual(['1.mp3', '3.mp3']);
        expect(ids({query: 'reese'})).toEqual(['1.mp3']);
        expect(ids({query: 'fm'})).toEqual(['1.mp3']);
    });
    it('matches a number against the BPM', () => {
        expect(ids({query: 'bass 124'})).toEqual(['3.mp3']);
    });
    it('filters by type, key and BPM range (a sound with no BPM fails a range)', () => {
        expect(ids({type: 'Bass'})).toEqual(['1.mp3', '3.mp3']);
        expect(ids({key: 'F minor'})).toEqual(['1.mp3']);
        expect(ids({bpmMin: 125})).toEqual(['1.mp3', '2.mp3']);
        expect(ids({bpmMin: '', bpmMax: '130'})).toEqual(['1.mp3', '3.mp3']);
    });
});

describe('sortSounds', () => {
    const by = (k) => sortSounds(SOUNDS, k).map((s) => s.url);
    it('keeps the given order by default', () => expect(by('default')).toEqual(['1.mp3', '2.mp3', '3.mp3', '4.mp3']));
    it('sorts titles naturally', () => expect(by('title')).toEqual(['1.mp3', '3.mp3', '4.mp3', '2.mp3']));
    it('puts missing values last', () => {
        expect(by('bpm')).toEqual(['3.mp3', '1.mp3', '2.mp3', '4.mp3']);
        expect(by('key')).toEqual(['3.mp3', '1.mp3', '2.mp3', '4.mp3']);
        expect(by('duration')).toEqual(['2.mp3', '1.mp3', '3.mp3', '4.mp3']);
    });
    it('does not mutate its input', () => {
        const before = SOUNDS.map((s) => s.url);
        sortSounds(SOUNDS, 'title');
        expect(SOUNDS.map((s) => s.url)).toEqual(before);
    });
});
