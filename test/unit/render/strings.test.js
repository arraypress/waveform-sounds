// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {fill, countText, DEFAULT_STRINGS} from '../../../src/js/render/strings.js';

describe('strings', () => {
    it('fill replaces known placeholders and leaves unknown ones', () => {
        expect(fill('Play {title} {x}', {title: 'Kick'})).toBe('Play Kick {x}');
    });
    it('countText: total, singular, filtered', () => {
        expect(countText(300, 300)).toBe('300 sounds');
        expect(countText(1, 1)).toBe('1 sound');
        expect(countText(12, 300)).toBe('12 of 300 sounds');
        expect(countText(2, 2, {...DEFAULT_STRINGS, count: '{count} geluiden'})).toBe('2 geluiden');
    });
});
