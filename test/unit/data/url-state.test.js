// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {urlKeys, parseBpmRange, formatBpmRange, readUrlState, writeUrlState} from '../../../src/js/data/url-state.js';

const available = {types: [{name: 'Bass'}, {name: 'Drums'}], keys: ['C', 'Fm']};
const SORTS = ['default', 'title', 'bpm'];

describe('urlKeys', () => {
    it('is off for falsy, plain for true, prefixed for a string', () => {
        expect(urlKeys(false)).toBeNull();
        expect(urlKeys(undefined)).toBeNull();
        expect(urlKeys(true)).toEqual({q: 'q', type: 'type', key: 'key', bpm: 'bpm', sort: 'sort'});
        expect(urlKeys('pack').type).toBe('pack-type');
    });
});

describe('BPM ranges', () => {
    it.each([
        ['120-130', {bpmMin: '120', bpmMax: '130'}], ['120-', {bpmMin: '120', bpmMax: ''}], ['-130', {bpmMin: '', bpmMax: '130'}],
        ['-', null], ['abc', null], ['', null], [null, null],
    ])('parses %j', (input, out) => expect(parseBpmRange(input)).toEqual(out));
    it('formats both ends, either end, or nothing', () => {
        expect(formatBpmRange(120, 130)).toBe('120-130');
        expect(formatBpmRange('', 130)).toBe('-130');
        expect(formatBpmRange('', '')).toBe('');
        expect(formatBpmRange(null, undefined)).toBe('');
    });
});

describe('readUrlState', () => {
    const keys = urlKeys(true);
    it('reads every field', () => {
        expect(readUrlState('?q=loop&type=Bass&key=F+minor&bpm=120-130&sort=title', keys, available, SORTS))
            .toEqual({filter: {query: 'loop', type: 'Bass', key: 'Fm', bpmMin: '120', bpmMax: '130'}, sort: 'title'});
    });
    it('ignores what the list cannot use', () => {
        expect(readUrlState('?type=Pads&key=Q&sort=key&bpm=x', keys, available, SORTS)).toEqual({filter: {}, sort: null});
    });
    it('reads nothing when off', () => {
        expect(readUrlState('?q=x', null, available, SORTS)).toEqual({filter: {}, sort: null});
    });
});

describe('writeUrlState', () => {
    const keys = urlKeys(true);
    const empty = {query: '', type: '', key: '', bpmMin: '', bpmMax: ''};
    it('writes set values, keeps other parameters and the hash', () => {
        expect(writeUrlState('https://x.test/p?a=1#h', keys, {...empty, query: ' bass ', type: 'Bass', bpmMin: '120'}, 'bpm', 'default'))
            .toBe('https://x.test/p?a=1&q=bass&type=Bass&bpm=120-&sort=bpm#h');
    });
    it('removes empty values and the starting sort', () => {
        expect(writeUrlState('https://x.test/p?q=old&sort=title', keys, empty, 'title', 'title')).toBe('https://x.test/p');
    });
    it('returns the href unchanged when off', () => {
        expect(writeUrlState('https://x.test/p?q=1', null, empty, 'bpm', 'default')).toBe('https://x.test/p?q=1');
    });
});
