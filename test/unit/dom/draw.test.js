// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {resample, barRects} from '../../../src/js/dom/draw.js';

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

describe('barRects', () => {
    const o = {style: 'mirror', barWidth: 2, barGap: 1};
    it('fits bars to the width (bar + gap per step)', () => {
        expect(barRects([0.5, 1], 30, 20, o)).toHaveLength(10); // (30 + 1) / 3
    });
    it('normalises to the loudest bar and keeps a 4% floor', () => {
        const r = barRects([0.25, 0.5, 0], 9, 102, o);
        expect(r.map((b) => b.h)).toEqual([50, 100, 4]);
    });
    it('mirror bars are centred; plain bars stand on the bottom', () => {
        const [m] = barRects([1], 2, 40, o);
        expect(m.y + m.h / 2).toBe(20);
        const [b] = barRects([1], 2, 40, {...o, style: 'bars'});
        expect(b.y + b.h).toBe(40);
    });
});
