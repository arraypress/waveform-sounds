// @vitest-environment node
// The renderer must run with no DOM: wrappers call it on the server.
import {describe, it, expect} from 'vitest';
import {renderSounds, renderSoundsElement} from '../src/js/render.js';
import * as renderEntry from '../src/js/render-entry.js';

const sounds = [
    {url: '/a.mp3', title: 'Bass <b>Loop</b>', type: 'Bass', bpm: 128, key: 'F minor', duration: 8, peaks: [0, 1]},
    {url: '/b.mp3', title: 'Kick', type: 'Drums', bpm: 140, key: 'C'},
];

describe('renderSounds (server)', () => {
    it('renders with no window or document', () => {
        expect(typeof window).toBe('undefined');
        expect(renderEntry.renderSounds(sounds)).toContain('data-ws-list');
    });

    it('escapes text and attributes', () => {
        const html = renderSounds([{url: '/x".mp3', title: '<script>alert(1)</script>'}]);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('data-url="/x&quot;.mp3"');
    });

    it('writes every field the runtime reads back', () => {
        const html = renderSounds(sounds);
        expect(html).toContain('data-ws-index="0"');
        expect(html).toContain('data-bpm="128"');
        expect(html).toContain('data-key="Fm"');
        expect(html).toContain('data-duration="8"');
        expect(html).toContain('data-peaks="00ff"');
        expect(html).toContain('>0:08<');
    });

    it('offers only the controls the data can use', () => {
        const one = renderSounds([{url: '/a.mp3', type: 'Bass'}, {url: '/b.mp3', type: 'Bass'}]);
        expect(one).not.toContain('data-ws-type=');
        expect(one).not.toContain('data-ws-key');
        expect(one).not.toContain('data-ws-bpm-min');
        const full = renderSounds(sounds);
        expect(full).toContain('data-ws-type="Bass"');
        expect(full).toContain('<option value="Fm">Fm</option>');
        expect(full).toContain('data-ws-bpm-min');
    });

    it('turns many types into a menu instead of a wall of chips', () => {
        const many = Array.from({length: 12}, (_, i) => ({url: `/${i}.mp3`, type: `T${i}`}));
        const html = renderSounds(many);
        expect(html).toContain('data-ws-type-select');
        expect(html).not.toContain('class="ws-chip"');
        expect(renderSounds(many, {maxTypeChips: 20})).toContain('class="ws-chip"');
    });

    it('pages: rows past pageSize are hidden and "Show more" counts them', () => {
        const many = Array.from({length: 7}, (_, i) => ({url: `/${i}.mp3`}));
        const html = renderSounds(many, {pageSize: 5});
        expect((html.match(/<li [^>]*hidden/g) || []).length).toBe(2);
        expect(html).toContain('Show 2 more');
        expect(renderSounds(many, {pageSize: 0})).not.toMatch(/<li [^>]*hidden/);
    });

    it('strip layout has no row waveforms and a visible engine slot', () => {
        const html = renderSounds(sounds, {player: 'strip'});
        expect(html).not.toContain('ws-wave');
        expect(html).toContain('ws-engine--strip');
        expect(renderSounds(sounds)).toMatch(/data-ws-engine hidden/);
    });

    it('honours columns and strings', () => {
        const html = renderSounds(sounds, {columns: ['bpm'], strings: {searchPlaceholder: 'Zoeken…'}});
        expect(html).not.toContain('ws-type"');
        expect(html).toContain('ws-bpm');
        expect(html).toContain('placeholder="Zoeken…"');
    });

    it('wraps in the auto-init element', () => {
        const html = renderSoundsElement(sounds, {player: 'strip'}, 'extra');
        expect(html.startsWith('<div class="waveform-sounds waveform-sounds--strip extra" data-waveform-sounds data-player="strip">')).toBe(true);
    });
});
