// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {resolveRenderOptions, allowedList, wholeNumber, defined, RENDER_DEFAULTS} from '../../../src/js/render/options.js';

describe('render options', () => {
    it('defined drops undefined only', () => {
        expect(defined({a: undefined, b: null, c: 0})).toEqual({b: null, c: 0});
        expect(defined(null)).toEqual({});
    });
    it('allowedList keeps known values in order, or falls back', () => {
        expect(allowedList(['bpm', 'nope', 'type'], ['type', 'bpm'], ['x'])).toEqual(['bpm', 'type']);
        expect(allowedList('type', ['type'], ['x'])).toEqual(['x']);
    });
    it('wholeNumber floors and rejects negatives/non-numbers', () => {
        expect(wholeNumber('12.7', 1)).toBe(12);
        expect(wholeNumber(-1, 5)).toBe(5);
        expect(wholeNumber('x', 5)).toBe(5);
        expect(wholeNumber(0, 5)).toBe(0);
    });
    it('resolveRenderOptions validates every enumeration and completes strings', () => {
        const o = resolveRenderOptions({player: 'grid', filters: ['bpm', 'zz'], sorts: [], columns: ['key'], pageSize: '10', strings: {loop: 'Herhalen'}});
        expect(o.player).toBe('inline');
        expect(o.filters).toEqual(['bpm']);
        expect(o.sorts).toEqual([]);
        expect(o.columns).toEqual(['key']);
        expect(o.pageSize).toBe(10);
        expect(o.menuSearch).toBe(RENDER_DEFAULTS.menuSearch);
        expect(o.strings.loop).toBe('Herhalen');
        expect(o.strings.search).toBe('Search sounds');
    });
});
