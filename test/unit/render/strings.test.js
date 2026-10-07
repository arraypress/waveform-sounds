// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {fill, countText, DEFAULT_STRINGS, bpmLabel} from '../../../src/js/render/strings.js';

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

describe('bpmLabel', () => {
    const extent = {min: 90, max: 140};
    it('is "Any BPM" with no limit, else the range (an open end shows the pack end)', () => {
        expect(bpmLabel({}, extent)).toBe('Any BPM');
        expect(bpmLabel({bpmMin: '', bpmMax: ''}, extent)).toBe('Any BPM');
        expect(bpmLabel({bpmMin: '120', bpmMax: '128'}, extent)).toBe('120–128 BPM');
        expect(bpmLabel({bpmMin: '120'}, extent)).toBe('120–140 BPM');
        expect(bpmLabel({bpmMax: '100'}, extent, {...DEFAULT_STRINGS, bpmRange: '{min} à {max}'})).toBe('90 à 100');
    });
});
