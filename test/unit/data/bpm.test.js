import {describe, it, expect} from 'vitest';
import {bpmFilterFromRange, bpmRangeFromFilter, bpmFraction, hasBpmFilter} from '../../../src/js/data/bpm.js';

const extent = {min: 90, max: 140};

describe('bpm range ↔ filter', () => {
    it('a handle at an end is no limit on that side (sounds without a BPM stay)', () => {
        expect(bpmFilterFromRange(90, 140, extent)).toEqual({bpmMin: '', bpmMax: ''});
        expect(bpmFilterFromRange(120, 140, extent)).toEqual({bpmMin: '120', bpmMax: ''});
        expect(bpmFilterFromRange(90, 128, extent)).toEqual({bpmMin: '', bpmMax: '128'});
        expect(bpmFilterFromRange(120, 128, extent)).toEqual({bpmMin: '120', bpmMax: '128'});
    });
    it('swapped handles still give an ordered range', () => {
        expect(bpmFilterFromRange(128, 120, extent)).toEqual({bpmMin: '120', bpmMax: '128'});
    });
    it('places the handles for a filter: open ends at the pack ends, values clamped', () => {
        expect(bpmRangeFromFilter({bpmMin: '', bpmMax: ''}, extent)).toEqual({lo: 90, hi: 140});
        expect(bpmRangeFromFilter({bpmMin: '120'}, extent)).toEqual({lo: 120, hi: 140});
        expect(bpmRangeFromFilter({bpmMin: '60', bpmMax: '300'}, extent)).toEqual({lo: 90, hi: 140});
        expect(bpmRangeFromFilter({bpmMin: '130', bpmMax: '100'}, extent)).toEqual({lo: 100, hi: 130});
        expect(bpmRangeFromFilter({bpmMin: 'abc'}, extent)).toEqual({lo: 90, hi: 140});
    });
    it('positions along the track, and whether any limit is set', () => {
        expect(bpmFraction(90, extent)).toBe(0);
        expect(bpmFraction(115, extent)).toBe(0.5);
        expect(bpmFraction(200, extent)).toBe(1);
        expect(bpmFraction(120, {min: 120, max: 120})).toBe(0);
        expect(hasBpmFilter({bpmMin: '', bpmMax: ''})).toBe(false);
        expect(hasBpmFilter({bpmMin: '', bpmMax: '128'})).toBe(true);
        expect(hasBpmFilter({})).toBe(false);
    });
});
