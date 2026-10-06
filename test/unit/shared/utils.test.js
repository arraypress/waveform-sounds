import {describe, it, expect} from 'vitest';
import {clamp, pointerFraction, isTyping, emit, hashString} from '../../../src/js/shared/utils.js';

describe('utils', () => {
    it('clamp', () => {
        expect(clamp(2)).toBe(1);
        expect(clamp(-1)).toBe(0);
        expect(clamp(5, 0, 10)).toBe(5);
    });
    it('pointerFraction', () => {
        expect(pointerFraction(150, {left: 100, width: 200})).toBe(0.25);
        expect(pointerFraction(50, {left: 100, width: 200})).toBe(0);
        expect(pointerFraction(10, {left: 0, width: 0})).toBe(0);
    });
    it('isTyping', () => {
        expect(isTyping(document.createElement('input'))).toBe(true);
        expect(isTyping(document.createElement('button'))).toBe(false);
        expect(isTyping(null)).toBe(false);
    });
    it('emit dispatches a bubbling waveformsounds:* event', () => {
        const parent = document.createElement('div');
        const child = document.createElement('span');
        parent.appendChild(child);
        let got = null;
        parent.addEventListener('waveformsounds:play', (e) => { got = e.detail; });
        emit(child, 'play', {a: 1});
        expect(got).toEqual({a: 1});
    });
    it('hashString is stable, unsigned 32-bit, and spreads', () => {
        expect(hashString('abc')).toBe(hashString('abc'));
        expect(hashString('abc')).not.toBe(hashString('abd'));
        expect(hashString('x'.repeat(10000))).toBeLessThan(2 ** 32);
        expect(hashString('')).toBe(5381);
    });
});
