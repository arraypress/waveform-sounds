import {describe, it, expect} from 'vitest';
import {parseAlpha, pageSurface} from '../../../src/js/dom/colors.js';

describe('parseAlpha', () => {
    it.each([
        ['rgb(1, 2, 3)', 1], ['rgba(0, 0, 0, 0)', 0], ['rgba(1, 2, 3, 0.5)', 0.5],
        ['rgb(1 2 3 / 50%)', 0.5], ['oklab(0.9 0 0 / 0.93)', 0.93], ['transparent', 0], ['', 0], ['#fff', 1],
    ])('%s → %s', (c, a) => expect(parseAlpha(c)).toBeCloseTo(a));
});

describe('pageSurface', () => {
    it('finds the first opaque background up the tree', () => {
        const outer = document.createElement('div');
        outer.style.backgroundColor = 'rgb(10, 10, 10)';
        const inner = document.createElement('div');
        inner.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        const el = document.createElement('div');
        inner.appendChild(el); outer.appendChild(inner); document.body.appendChild(outer);
        expect(pageSurface(el)).toBe('rgb(10, 10, 10)');
        outer.remove();
    });
    it('falls back to white when nothing is painted', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        expect(pageSurface(el)).toBe('#fff');
        el.remove();
    });
});
