// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {resample} from '../../../src/js/dom/draw.js';

describe('resample', () => {
    it('keeps the loudest value of each bucket (transients survive)', () => {
        expect(resample([0.1, 0.9, 0.2, 0.3], 2)).toEqual([0.9, 0.3]);
    });
    it('returns the input at the same length, and [] for nothing', () => {
        const p = [0.1, 0.2];
        expect(resample(p, 2)).toBe(p);
        expect(resample(null, 4)).toEqual([]);
        expect(resample([0.5], 0)).toEqual([]);
    });
});
