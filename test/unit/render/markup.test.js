// @vitest-environment node
// The renderer must run with no DOM: wrappers call it on the server.
import {describe, it, expect} from 'vitest';
import {renderSounds, renderSoundsElement, toolbarPlan, idBase, loopsByDefault} from '../../../src/js/render/markup.js';
import {facets, normalizeSounds} from '../../../src/js/data/sounds.js';
import {resolveRenderOptions} from '../../../src/js/render/options.js';
import * as renderEntry from '../../../src/js/render-entry.js';

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
        expect(one).not.toContain('data-ws-menu="key"');
        expect(one).not.toContain('data-ws-bpm-min');
        const full = renderSounds(sounds);
        expect(full).toContain('data-ws-type="Bass"');
        expect(full).toContain('data-ws-menu="key"');
        expect(full).toMatch(/role="option"[^>]*data-value="Fm"/);
        expect(full).toContain('data-ws-bpm-min');
    });

    it('turns many types into a menu instead of a wall of chips', () => {
        const many = Array.from({length: 12}, (_, i) => ({url: `/${i}.mp3`, type: `T${i}`}));
        const html = renderSounds(many);
        expect(html).toContain('data-ws-menu="type"');
        expect(html).not.toContain('class="ws-chip"');
        expect(renderSounds(many, {maxTypeChips: 20})).toContain('class="ws-chip"');
    });

    it('a long menu gets a search field; a short one does not', () => {
        const many = Array.from({length: 12}, (_, i) => ({url: `/${i}.mp3`, type: `T${i}`}));
        expect(renderSounds(many)).toMatch(/data-ws-menu="type"[\s\S]*data-ws-menu-search/);
        const html = renderSounds(sounds);
        expect(html).not.toContain('data-ws-menu-search'); // 3 keys, 5 sorts
        expect(renderSounds(many, {menuSearch: 50})).not.toContain('data-ws-menu-search');
    });

    it('every control can be removed', () => {
        const html = renderSounds(sounds, {search: false, filters: [], sorts: [], loopToggle: false, showCount: false, columns: []});
        for (const hook of ['data-ws-search', 'data-ws-type=', 'data-ws-menu=', 'data-ws-bpm-min', 'data-ws-loop', 'data-ws-count', 'ws-bpm"', 'ws-type"']) {
            expect(html).not.toContain(hook);
        }
    });

    it('removing BPM is filters + columns + sorts', () => {
        const html = renderSounds(sounds, {filters: ['type', 'key'], columns: ['type', 'key', 'duration'], sorts: ['default', 'title', 'key']});
        expect(html).not.toContain('data-ws-bpm-min');
        expect(html).not.toContain('class="ws-cell ws-bpm"');
        expect(html).not.toMatch(/data-value="bpm"/);
    });

    it('sorts sets the menu order and drops orders the data cannot use', () => {
        const html = renderSounds([{url: '/a.mp3', title: 'A'}, {url: '/b.mp3', title: 'B'}], {sorts: ['title', 'bpm', 'default']});
        expect([...html.matchAll(/data-ws-menu="sort"[\s\S]*?<\/ul>/g)][0][0].match(/data-value="(\w+)"/g)).toEqual(['data-value="title"', 'data-value="default"']);
    });

    it('a sound with a download link gets a download button; others get nothing', () => {
        const html = renderSounds([{url: '/a.mp3', title: 'Kick', download: '/free/kick.wav'}, {url: '/b.mp3', title: 'Snare'}]);
        expect(html).toContain('<a class="ws-download" href="/free/kick.wav" download aria-label="Download Kick">');
        expect(html.match(/ws-download/g)).toHaveLength(1);
        expect(html).toContain('data-download="/free/kick.wav"');
    });

    it('idPrefix makes two lists of the same sounds distinct', () => {
        expect(renderSounds(sounds, {idPrefix: 'a'})).toContain('id="a-key-list"');
        expect(renderSounds(sounds, {idPrefix: 'b'})).toContain('id="b-key-list"');
    });

    it('menu ids are stable across renders and unique per list', () => {
        expect(renderSounds(sounds)).toBe(renderSounds(sounds));
        const a = renderSounds(sounds).match(/id="(ws[^-"]+)-/)[1];
        const b = renderSounds([{url: '/z.mp3', key: 'C'}, {url: '/y.mp3', key: 'D'}]).match(/id="(ws[^-"]+)-/)[1];
        expect(a).not.toBe(b);
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

describe('toolbarPlan', () => {
    const plan = (sounds, opts = {}) => toolbarPlan(facets(normalizeSounds(sounds)), resolveRenderOptions(opts));
    const many = Array.from({length: 4}, (_, i) => ({url: `/${i}.mp3`, type: `T${i}`, key: i % 2 ? 'C' : 'Fm', bpm: 120 + i, duration: 8}));
    it('shows a control only when the data gives it something to do', () => {
        expect(plan([{url: '/a.mp3'}, {url: '/b.mp3'}])).toMatchObject({types: null, key: false, bpm: false, sorts: ['default', 'title']});
        expect(plan(many)).toMatchObject({types: 'chips', key: true, bpm: true, sorts: ['default', 'title', 'bpm', 'key', 'duration']});
    });
    it('types become a menu past maxTypeChips; disabled controls stay off', () => {
        expect(plan(many, {maxTypeChips: 2}).types).toBe('menu');
        expect(plan(many, {filters: ['type'], sorts: ['title']})).toMatchObject({key: false, bpm: false, sorts: []});
    });
    it('offers loops or one-shots only for a list with both', () => {
        const mixed = [{url: '/a.mp3', loop: true}, {url: '/b.mp3'}];
        expect(plan(mixed).loops).toBe(true);
        expect(plan([{url: '/a.mp3', loop: true}, {url: '/b.mp3', loop: true}]).loops).toBe(false);
        expect(plan([{url: '/a.mp3'}, {url: '/b.mp3'}]).loops).toBe(false);
        expect(plan(mixed, {filters: ['type']}).loops).toBe(false);
    });
});

describe('loops in the markup', () => {
    // Server-side (no DOM here): string checks on the renderer's output.
    const html = renderSounds([{url: '/a.mp3', title: 'Drum Loop', loop: true}, {url: '/b.mp3', title: 'Kick'}]);
    const rowsOf = (markup) => markup.split('<li class="ws-row"').slice(1);

    it('renders the three-way filter, All pressed', () => {
        expect(html).toContain('<div class="ws-seg" role="group" aria-label="Loops or one-shots">');
        expect(html).toMatch(/data-ws-loop-filter="" aria-pressed="true"><span>All<\/span>/);
        expect(html).toMatch(/data-ws-loop-filter="loop" aria-pressed="false"><span>Loops<\/span>/);
        expect(html).toMatch(/data-ws-loop-filter="one-shot" aria-pressed="false"><span>One-shots<\/span>/);
    });

    it('marks a loop row (attribute + icon with a text alternative); a one-shot carries nothing', () => {
        const [loop, shot] = rowsOf(html);
        expect(loop).toContain('data-loop="true"');
        expect(loop).toContain('<span class="ws-title-text">Drum Loop</span>');
        expect(loop).toMatch(/class="ws-loop-mark"[^>]*>.*<span class="ws-sr">Loop<\/span>/);
        expect(shot).not.toContain('data-loop');
        expect(shot).not.toContain('ws-loop-mark');
    });

    it('no filter for a list without loops', () => {
        expect(renderSounds([{url: '/a.mp3'}, {url: '/b.mp3'}])).not.toContain('ws-seg');
    });
});

describe('idBase', () => {
    it('is stable for the same sounds and differs for others', () => {
        expect(idBase([{url: '/a.mp3'}])).toBe(idBase([{url: '/a.mp3'}]));
        expect(idBase([{url: '/a.mp3'}])).not.toBe(idBase([{url: '/b.mp3'}]));
        expect(idBase([{url: '/a.mp3'}])).toMatch(/^ws[0-9a-z]+$/);
    });
});

describe('the BPM menu', () => {
    const html = renderSounds([{url: '/a.mp3', bpm: 121}, {url: '/b.mp3', bpm: 128}, {url: '/c.mp3'}], {idPrefix: 'p'});
    it('is a button opening a dialog with two range handles across the pack\'s tempos', () => {
        expect(html).toContain('data-ws-menu="bpm"');
        expect(html).toContain('aria-haspopup="dialog"');
        expect(html).toMatch(/<span class="ws-menu-value" data-ws-menu-value>Any BPM<\/span>/);
        expect(html).toMatch(/<input type="range" class="ws-range-input" data-ws-bpm-min aria-label="Min BPM" min="121" max="128" step="1" value="121">/);
        expect(html).toMatch(/<input type="range" class="ws-range-input" data-ws-bpm-max aria-label="Max BPM" min="121" max="128" step="1" value="128">/);
        expect(html).toContain('id="p-bpm-pop" role="dialog"');
    });
    it('writes no style attribute (a strict CSP would block it)', () => {
        expect(html).not.toMatch(/ style="/);
    });
});

describe('the Loop toggle\'s starting state', () => {
    it('follows the data unless the loop option says otherwise', () => {
        expect(loopsByDefault(null, {loops: 2})).toBe(true);
        expect(loopsByDefault(undefined, {loops: 0})).toBe(false);
        expect(loopsByDefault(false, {loops: 2})).toBe(false);
        expect(loopsByDefault(true, {loops: 0})).toBe(true);
    });
    it('is rendered pressed for a list that marks loops', () => {
        expect(renderSounds([{url: '/a.mp3', loop: true}, {url: '/b.mp3'}])).toContain('data-ws-loop aria-pressed="true"');
        expect(renderSounds([{url: '/a.mp3'}, {url: '/b.mp3'}])).toContain('data-ws-loop aria-pressed="false"');
        expect(renderSounds([{url: '/a.mp3', loop: true}, {url: '/b.mp3'}], {loop: false})).toContain('data-ws-loop aria-pressed="false"');
    });
});
