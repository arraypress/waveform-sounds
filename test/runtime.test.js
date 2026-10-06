import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {settle, MockWaveformPlayer} from './setup.js';
import {WaveformSounds} from '../src/js/entry.js';
import {renderSoundsElement} from '../src/js/render.js';

const SOUNDS = [
    {url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm', duration: 8, peaks: '204060'},
    {url: '/s/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140, duration: 4},
    {url: '/s/bass-02.mp3', title: 'Bass Loop 02', type: 'Bass', bpm: 124, key: 'C', duration: 16},
    {url: '/s/crash.mp3', title: 'Crash', type: 'One-shots'},
];

let host;
beforeEach(() => {
    MockWaveformPlayer.instances = [];
    host = document.createElement('div');
    document.body.appendChild(host);
});
afterEach(() => {
    WaveformSounds.instances.forEach((i) => i.destroy());
    host.remove();
    vi.useRealTimers();
});

const rows = () => [...host.querySelectorAll('[data-ws-index]')];
const visibleTitles = () => rows().filter((r) => !r.hidden).map((r) => r.dataset.title);
async function make(options = {}) {
    const ws = new WaveformSounds(host, {sounds: SOUNDS, ...options});
    await ws.ready;
    return ws;
}

describe('building the list', () => {
    it('renders the sounds, toolbar and count', async () => {
        await make();
        expect(rows()).toHaveLength(4);
        expect(host.classList.contains('waveform-sounds--inline')).toBe(true);
        expect(host.querySelector('[data-ws-count]').textContent).toBe('4 sounds');
        expect(host.querySelectorAll('[data-ws-type]')).toHaveLength(4); // All + 3 types
    });

    it('adopts server-rendered markup instead of re-rendering it', async () => {
        host.innerHTML = renderSoundsElement(SOUNDS);
        const el = host.firstElementChild;
        const firstRow = el.querySelector('[data-ws-index]');
        const ws = new WaveformSounds(el);
        await ws.ready;
        expect(el.querySelector('[data-ws-index]')).toBe(firstRow);
        expect(ws.sounds[0]).toMatchObject({title: 'Bass Loop 01', bpm: 128, key: 'Fm'});
        expect(ws.sounds[0].peaks).toHaveLength(3);
    });

    it('renumbers adopted rows so a dropped row leaves no hole', async () => {
        host.innerHTML = renderSoundsElement(SOUNDS);
        const el = host.firstElementChild;
        el.querySelector('[data-ws-index="1"]').remove();
        const ws = new WaveformSounds(el);
        await ws.ready;
        expect(ws.sounds.map((s) => s.title)).toEqual(['Bass Loop 01', 'Bass Loop 02', 'Crash']);
        expect([...el.querySelectorAll('[data-ws-index]')].map((r) => r.dataset.wsIndex)).toEqual(['0', '1', '2']);
    });

    it('fetches a manifest when given no sounds', async () => {
        const fetchMock = vi.fn(async () => ({ok: true, json: async () => ({version: 1, sounds: SOUNDS.slice(0, 2)})}));
        vi.stubGlobal('fetch', fetchMock);
        const ws = new WaveformSounds(host, {manifest: '/sounds.json'});
        await ws.ready;
        expect(fetchMock).toHaveBeenCalledWith('/sounds.json');
        expect(rows()).toHaveLength(2);
        vi.unstubAllGlobals();
    });

    it('reads data-* options, which win over constructor options', async () => {
        host.dataset.player = 'strip';
        host.dataset.search = 'false';
        await make({player: 'inline'});
        expect(host.classList.contains('waveform-sounds--strip')).toBe(true);
        expect(host.querySelector('[data-ws-search]')).toBeNull();
        expect(host.querySelector('.ws-wave')).toBeNull();
    });

    it('reads strings and playerOptions as JSON data attributes', async () => {
        host.dataset.strings = JSON.stringify({count: '{count} geluiden'});
        host.dataset.playerOptions = JSON.stringify({height: 99});
        const ws = await make();
        expect(host.querySelector('[data-ws-count]').textContent).toBe('4 geluiden');
        ws.play(0);
        await settle();
        expect(MockWaveformPlayer.instances[0].options.height).toBe(99);
    });

    it('fires ready after the constructor returns, with ready already set', async () => {
        const seen = [];
        const ws = new WaveformSounds(host, {sounds: SOUNDS, onReady: (i) => seen.push(i.ready instanceof Promise)});
        host.addEventListener('waveformsounds:ready', () => seen.push('event'));
        expect(seen).toEqual([]);
        await ws.ready;
        expect(seen).toEqual(['event', true]); // the DOM event, then onReady
    });

    it('destroy() removes only the classes it added', async () => {
        host.classList.add('mine');
        const ws = await make();
        ws.destroy();
        expect([...host.classList]).toEqual(['mine']);
        host.innerHTML = renderSoundsElement(SOUNDS);
        const el = host.firstElementChild;
        const adopted = new WaveformSounds(el);
        await adopted.ready;
        adopted.destroy();
        expect(el.classList.contains('waveform-sounds')).toBe(true);
    });

    it('honours setFilter, setSort and play made before the list exists', async () => {
        const ws = new WaveformSounds(host, {sounds: SOUNDS});
        ws.setFilter({query: 'bass'});
        ws.setSort('bpm');
        ws.play('sound-3');
        await ws.ready;
        await settle();
        expect(host.querySelector('[data-ws-search]').value).toBe('bass');
        expect(host.querySelector('[data-ws-sort]').value).toBe('bpm');
        expect(visibleTitles()).toEqual(['Bass Loop 02', 'Bass Loop 01']);
        expect(ws.current.title).toBe('Bass Loop 02');
    });

    it('init() is idempotent and getInstance finds the instance', async () => {
        host.setAttribute('data-waveform-sounds', '');
        host.innerHTML = '';
        const [a] = WaveformSounds.init(document);
        expect(WaveformSounds.init(document)).toHaveLength(0);
        expect(WaveformSounds.getInstance(host)).toBe(a);
    });

    it('destroy() restores what the container held and forgets the instance', async () => {
        host.innerHTML = '<p>before</p>';
        const ws = await make();
        ws.destroy();
        expect(host.innerHTML).toBe('<p>before</p>');
        expect(WaveformSounds.getInstance(host)).toBeNull();
    });
});

describe('filtering, sorting and paging', () => {
    it('type chips filter, and the count reports it', async () => {
        await make();
        host.querySelector('[data-ws-type="Bass"]').click();
        expect(visibleTitles()).toEqual(['Bass Loop 01', 'Bass Loop 02']);
        expect(host.querySelector('[data-ws-type="Bass"]').getAttribute('aria-pressed')).toBe('true');
        expect(host.querySelector('[data-ws-type=""]').getAttribute('aria-pressed')).toBe('false');
        expect(host.querySelector('[data-ws-count]').textContent).toBe('2 of 4 sounds');
    });

    it('search is debounced and matches every word', async () => {
        vi.useFakeTimers();
        const ws = new WaveformSounds(host, {sounds: SOUNDS});
        await vi.runAllTimersAsync();
        await ws.ready;
        const input = host.querySelector('[data-ws-search]');
        input.value = 'loop 140';
        input.dispatchEvent(new Event('input'));
        expect(visibleTitles()).toHaveLength(4);
        vi.advanceTimersByTime(150);
        expect(visibleTitles()).toEqual(['Drum Loop 01']);
    });

    it('the type menu filters like the chips', async () => {
        const ws = await make({maxTypeChips: 1});
        const sel = host.querySelector('[data-ws-type-select]');
        sel.value = 'Drums';
        sel.dispatchEvent(new Event('change'));
        expect(visibleTitles()).toEqual(['Drum Loop 01']);
        ws.clearFilters();
        expect(sel.value).toBe('');
    });

    it('shows the empty state and clears from it', async () => {
        const ws = await make();
        ws.setFilter({query: 'nothing matches this'});
        expect(host.querySelector('[data-ws-empty]').hidden).toBe(false);
        host.querySelector('[data-ws-clear]').click();
        expect(visibleTitles()).toHaveLength(4);
        expect(host.querySelector('[data-ws-empty]').hidden).toBe(true);
    });

    it('sorting reorders the rows in the DOM', async () => {
        const ws = await make();
        ws.setSort('bpm');
        expect(rows().map((r) => r.dataset.title)).toEqual(['Bass Loop 02', 'Bass Loop 01', 'Drum Loop 01', 'Crash']);
        expect(host.querySelector('[data-ws-sort]').value).toBe('bpm');
    });

    it('pages with Show more, and a filter change resets the page', async () => {
        const ws = await make({pageSize: 2});
        expect(visibleTitles()).toHaveLength(2);
        const more = host.querySelector('[data-ws-more]');
        expect(more.textContent).toBe('Show 2 more');
        more.click();
        expect(visibleTitles()).toHaveLength(4);
        expect(more.hidden).toBe(true);
        ws.setFilter({type: ''});
        expect(visibleTitles()).toHaveLength(2);
    });

    it('emits waveformsounds:filter with counts', async () => {
        const ws = await make();
        const seen = [];
        host.addEventListener('waveformsounds:filter', (e) => seen.push(e.detail));
        ws.setFilter({type: 'Drums'});
        expect(seen.at(-1)).toMatchObject({visible: 1, total: 4, filter: {type: 'Drums'}});
    });
});

describe('playback', () => {
    it('plays through ONE self-mode engine, passing the row peaks', async () => {
        const ws = await make();
        rows()[0].querySelector('.ws-play').click();
        await settle();
        expect(MockWaveformPlayer.instances).toHaveLength(1);
        const engine = MockWaveformPlayer.instances[0];
        expect(engine.options.audioMode).toBe('self');
        expect(engine.calls.loadTrack[0]).toMatchObject({url: '/s/bass-01.mp3', title: 'Bass Loop 01', artist: 'Bass'});
        expect(engine.calls.loadTrack[0].options.waveform).toHaveLength(3);
        expect(ws.playing).toBe(true);
        rows()[2].querySelector('.ws-play').click();
        await settle();
        expect(MockWaveformPlayer.instances).toHaveLength(1);
        expect(engine.calls.loadTrack).toHaveLength(2);
    });

    it('marks the playing row and toggles to pause', async () => {
        const ws = await make();
        const btn = rows()[1].querySelector('.ws-play');
        btn.click();
        await settle();
        expect(rows()[1].classList.contains('is-playing')).toBe(true);
        expect(btn.getAttribute('aria-pressed')).toBe('true');
        expect(btn.getAttribute('aria-label')).toBe('Pause Drum Loop 01');
        btn.click();
        expect(ws.playing).toBe(false);
        expect(btn.getAttribute('aria-pressed')).toBe('false');
        expect(rows()[1].classList.contains('is-current')).toBe(true);
    });

    it('emits play/pause events and calls the callbacks', async () => {
        const onPlay = vi.fn();
        const ws = await make({onPlay});
        const events = [];
        host.addEventListener('waveformsounds:play', (e) => events.push(e.detail.sound.title));
        ws.play('sound-2');
        await settle();
        expect(events).toEqual(['Drum Loop 01']);
        expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({title: 'Drum Loop 01'}), ws);
    });

    it('calls the engine callbacks a caller passed in playerOptions too', async () => {
        const onPlay = vi.fn();
        const ws = await make({playerOptions: {onPlay}});
        ws.play(0);
        await settle();
        expect(onPlay).toHaveBeenCalled();
    });

    it('Loop sets the engine audio to loop, before and after loading', async () => {
        const ws = await make();
        host.querySelector('[data-ws-loop]').click();
        expect(host.querySelector('[data-ws-loop]').getAttribute('aria-pressed')).toBe('true');
        ws.play(0);
        await settle();
        expect(MockWaveformPlayer.instances[0].audio.loop).toBe(true);
        ws.setLoop(false);
        expect(MockWaveformPlayer.instances[0].audio.loop).toBe(false);
    });

    it('autoAdvance plays the next VISIBLE sound when one ends', async () => {
        const ws = await make({autoAdvance: true});
        ws.setFilter({type: 'Bass'});
        ws.play(0);
        await settle();
        MockWaveformPlayer.instances[0]._end();
        await settle();
        expect(ws.current.title).toBe('Bass Loop 02');
    });

    it('next() reveals a sound beyond the current page', async () => {
        const ws = await make({pageSize: 1});
        ws.play(0);
        await settle();
        ws.next();
        await settle();
        expect(ws.current.title).toBe('Drum Loop 01');
        expect(rows()[1].hidden).toBe(false);
    });

    it('seeking a row that is not playing starts it at that point', async () => {
        const ws = await make();
        ws.play(2, {at: 0.5});
        await settle();
        const engine = MockWaveformPlayer.instances[0];
        expect(engine.calls.seekTo.at(-1)).toBeCloseTo(50); // mock duration 100s
        expect(ws.progress).toBeCloseTo(0.5);
    });

    it('tracks progress from the engine', async () => {
        const ws = await make();
        ws.play(0);
        await settle();
        MockWaveformPlayer.instances[0]._tick(25);
        expect(ws.progress).toBeCloseTo(0.25);
    });

    it('warns and does nothing without a WaveformPlayer', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const saved = window.WaveformPlayer;
        delete window.WaveformPlayer;
        const ws = await make();
        ws.play(0);
        expect(err).toHaveBeenCalledWith(expect.stringContaining('@arraypress/waveform-player is required'));
        window.WaveformPlayer = saved;
        err.mockRestore();
    });

    it('accepts playerClass instead of the global', async () => {
        const saved = window.WaveformPlayer;
        delete window.WaveformPlayer;
        const ws = await make({playerClass: MockWaveformPlayer});
        ws.play(0);
        await settle();
        expect(MockWaveformPlayer.instances).toHaveLength(1);
        window.WaveformPlayer = saved;
    });
});

describe('keyboard', () => {
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}));

    it('/ focuses the search', async () => {
        await make();
        key(rows()[0].querySelector('.ws-play'), '/');
        expect(document.activeElement).toBe(host.querySelector('[data-ws-search]'));
    });

    it('ArrowDown from the search moves into the list', async () => {
        await make();
        key(host.querySelector('[data-ws-search]'), 'ArrowDown');
        expect(document.activeElement).toBe(rows()[0].querySelector('.ws-play'));
    });

    it('arrows move focus, and audition while something plays', async () => {
        const ws = await make();
        const first = rows()[0].querySelector('.ws-play');
        first.focus();
        key(first, 'ArrowDown');
        expect(document.activeElement).toBe(rows()[1].querySelector('.ws-play'));
        expect(MockWaveformPlayer.instances).toHaveLength(0); // nothing playing: just moves
        ws.play(1);
        await settle();
        key(rows()[1].querySelector('.ws-play'), 'ArrowDown');
        await settle();
        expect(ws.current.title).toBe('Bass Loop 02');
    });

    it('arrows skip hidden rows', async () => {
        const ws = await make();
        ws.setFilter({type: 'Bass'});
        const first = rows()[0].querySelector('.ws-play');
        first.focus();
        key(first, 'ArrowDown');
        expect(document.activeElement).toBe(rows()[2].querySelector('.ws-play'));
    });

    it('arrowAudition: false only moves focus', async () => {
        const ws = await make({arrowAudition: false});
        ws.play(0);
        await settle();
        key(rows()[0].querySelector('.ws-play'), 'ArrowDown');
        await settle();
        expect(ws.current.title).toBe('Bass Loop 01');
    });
});
