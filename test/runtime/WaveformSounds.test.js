import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {settle, MockWaveformPlayer} from '../setup.js';
import {WaveformSounds} from '../../src/js/entry.js';
import {renderSoundsElement} from '../../src/js/render/markup.js';

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
        host.dataset.barWidth = '3';
        host.dataset.barGap = '0';
        const ws = await make();
        expect(host.querySelector('[data-ws-count]').textContent).toBe('4 geluiden');
        ws.play(0);
        await settle();
        expect(MockWaveformPlayer.instances[0].options.height).toBe(99);
        expect(ws.options.barWidth).toBe(3);
        expect(ws.options.barGap).toBe(0);
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
        expect(host.querySelector('[data-ws-menu="sort"] [data-ws-menu-value]').textContent).toBe('BPM');
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
        const menu = host.querySelector('[data-ws-menu="type"]');
        menu.querySelector('[data-ws-menu-btn]').click();
        expect(menu.querySelector('[data-ws-menu-pop]').hidden).toBe(false);
        menu.querySelector('[role="option"][data-value="Drums"]').click();
        expect(visibleTitles()).toEqual(['Drum Loop 01']);
        expect(menu.querySelector('[data-ws-menu-pop]').hidden).toBe(true);
        expect(menu.querySelector('[data-ws-menu-value]').textContent).toBe('Drums');
        ws.clearFilters();
        expect(menu.querySelector('[data-ws-menu-value]').textContent).toBe('All types');
    });

    it('a searchable menu narrows as you type and picks from the keyboard', async () => {
        await make({maxTypeChips: 1, menuSearch: 2});
        const menu = host.querySelector('[data-ws-menu="type"]');
        const btn = menu.querySelector('[data-ws-menu-btn]');
        btn.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
        const search = menu.querySelector('[data-ws-menu-search]');
        expect(document.activeElement).toBe(search);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
        search.value = 'one';
        search.dispatchEvent(new Event('input'));
        const shown = [...menu.querySelectorAll('[role="option"]')].filter((o) => !o.hidden).map((o) => o.dataset.value);
        expect(shown).toEqual(['One-shots']);
        expect(search.getAttribute('aria-activedescendant')).toBe(menu.querySelector('[data-value="One-shots"]').id);
        search.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
        expect(visibleTitles()).toEqual(['Crash']);
        expect(document.activeElement).toBe(btn);
    });

    it('a menu shows "No matches" and Esc closes it', async () => {
        await make({maxTypeChips: 1, menuSearch: 2});
        const menu = host.querySelector('[data-ws-menu="type"]');
        menu.querySelector('[data-ws-menu-btn]').click();
        const search = menu.querySelector('[data-ws-menu-search]');
        search.value = 'zzz';
        search.dispatchEvent(new Event('input'));
        expect(menu.querySelector('[data-ws-menu-none]').hidden).toBe(false);
        search.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
        expect(menu.querySelector('[data-ws-menu-pop]').hidden).toBe(true);
    });

    it('a click outside closes an open menu', async () => {
        await make();
        const menu = host.querySelector('[data-ws-menu="sort"]');
        menu.querySelector('[data-ws-menu-btn]').click();
        document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}));
        expect(menu.querySelector('[data-ws-menu-pop]').hidden).toBe(true);
    });

    it('arrows in a menu move the active option, and Enter picks it', async () => {
        await make();
        const menu = host.querySelector('[data-ws-menu="sort"]');
        menu.querySelector('[data-ws-menu-btn]').click();
        const list = menu.querySelector('[data-ws-menu-list]');
        list.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
        list.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));
        list.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
        expect(rows().map((r) => r.dataset.title)).toEqual(['Bass Loop 02', 'Bass Loop 01', 'Drum Loop 01', 'Crash']);
    });

    it('starts in the first offered sort order', async () => {
        const ws = await make({sorts: ['title', 'default']});
        expect(ws.sortBy).toBe('title');
        expect(rows().map((r) => r.dataset.title)).toEqual(['Bass Loop 01', 'Bass Loop 02', 'Crash', 'Drum Loop 01']);
    });

    it('detects the page surface for the inverted states, and follows a theme flip', async () => {
        document.body.style.backgroundColor = 'rgb(10, 10, 10)';
        await make();
        expect(host.style.getPropertyValue('--ws-surface')).toBe('rgb(10, 10, 10)');
        document.body.style.backgroundColor = 'rgb(250, 250, 250)';
        WaveformSounds.getInstance(host)._resolveColors();
        expect(host.style.getPropertyValue('--ws-surface')).toBe('rgb(250, 250, 250)');
        document.body.style.backgroundColor = '';
    });

    it('leaves a --ws-surface the site set alone', async () => {
        host.style.setProperty('--ws-surface', 'red');
        await make();
        expect(host.style.getPropertyValue('--ws-surface')).toBe('red');
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
        expect(host.querySelector('[data-ws-menu="sort"] [data-ws-menu-value]').textContent).toBe('BPM');
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
    it('builds the engine at ready when the player is on the page, loading nothing', async () => {
        await make();
        expect(MockWaveformPlayer.instances).toHaveLength(1);
        expect(MockWaveformPlayer.instances[0].calls.loadTrack).toHaveLength(0);
        expect(MockWaveformPlayer.instances[0].options.url).toBeUndefined();
    });

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

    it('with loops marked, Loop repeats only loops; a one-shot plays once', async () => {
        const ws = await make({sounds: [{url: '/l.mp3', title: 'Drum Loop', loop: true}, {url: '/k.mp3', title: 'Kick'}], loop: true});
        ws.play(0);
        await settle();
        const audio = MockWaveformPlayer.instances[0].audio;
        expect(audio.loop).toBe(true);
        ws.play(1);
        await settle();
        expect(audio.loop).toBe(false);
        ws.setLoop(true); // re-applying keeps the one-shot single
        expect(audio.loop).toBe(false);
    });

    it('Loop starts on for a list that marks loops, off otherwise, and an option or setLoop wins', async () => {
        const marked = [{url: '/l.mp3', title: 'Drum Loop', loop: true}, {url: '/k.mp3', title: 'Kick'}];
        let ws = await make({sounds: marked});
        expect(ws.loop).toBe(true);
        expect(host.querySelector('[data-ws-loop]').getAttribute('aria-pressed')).toBe('true');
        ws.destroy();
        ws = await make();
        expect(ws.loop).toBe(false);
        ws.destroy();
        ws = await make({sounds: marked, loop: false});
        expect(ws.loop).toBe(false);
        ws.destroy();
        ws = new WaveformSounds(host, {sounds: marked});
        ws.setLoop(false); // before ready: kept
        await ws.ready;
        expect(ws.loop).toBe(false);
    });

    it('the BPM handles filter (an end is open), cannot cross, and clear resets', async () => {
        vi.useFakeTimers();
        const ws = new WaveformSounds(host, {sounds: SOUNDS});
        await vi.runAllTimersAsync();
        await ws.ready;
        const min = host.querySelector('[data-ws-bpm-min]'), max = host.querySelector('[data-ws-bpm-max]');
        const label = () => host.querySelector('[data-ws-menu="bpm"] [data-ws-menu-value]').textContent;
        expect([min.min, min.max, min.value, max.value]).toEqual(['124', '140', '124', '140']);
        min.value = '125';
        min.dispatchEvent(new Event('input', {bubbles: true}));
        expect(label()).toBe('125–140 BPM'); // the label follows the drag at once
        expect(ws.filter.bpmMin).toBe(''); // the list waits for it to settle
        await vi.advanceTimersByTimeAsync(300);
        expect(ws.filter).toMatchObject({bpmMin: '125', bpmMax: ''});
        expect(visibleTitles()).toEqual(['Bass Loop 01', 'Drum Loop 01']);
        max.value = '120'; // dragged past the lower handle: stops at it
        max.dispatchEvent(new Event('input', {bubbles: true}));
        expect(max.value).toBe('125');
        host.querySelector('[data-ws-bpm-clear]').click();
        expect(ws.filter).toMatchObject({bpmMin: '', bpmMax: ''});
        expect(label()).toBe('Any BPM');
        expect([min.value, max.value]).toEqual(['124', '140']);
        expect(visibleTitles()).toHaveLength(4);
    });

    it('the loops filter: All / Loops / One-shots, kept in sync', async () => {
        const ws = await make({sounds: [{url: '/l.mp3', title: 'Drum Loop', loop: true}, {url: '/k.mp3', title: 'Kick'}, {url: '/s.mp3', title: 'Snare'}]});
        const btn = (v) => host.querySelector(`[data-ws-loop-filter="${v}"]`);
        btn('loop').click();
        expect(visibleTitles()).toEqual(['Drum Loop']);
        expect(btn('loop').getAttribute('aria-pressed')).toBe('true');
        expect(btn('').getAttribute('aria-pressed')).toBe('false');
        btn('one-shot').click();
        expect(visibleTitles()).toEqual(['Kick', 'Snare']);
        ws.clearFilters();
        expect(visibleTitles()).toHaveLength(3);
        expect(btn('').getAttribute('aria-pressed')).toBe('true');
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

    it('a natural end emits end once and no extra pause', async () => {
        const ws = await make();
        const seen = [];
        ['pause', 'end'].forEach((n) => host.addEventListener(`waveformsounds:${n}`, () => seen.push(n)));
        ws.play(0);
        await settle();
        const engine = MockWaveformPlayer.instances[0];
        engine.options.onPause(engine); // the browser's pause, fired before ended
        engine._end();
        expect(seen).toEqual(['pause', 'end']);
        expect(ws.playing).toBe(false);
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

    it('touch: a press on a waveform does NOT seek (it may be a scroll); the tap does', async () => {
        const ws = await make();
        const wave = rows()[2].querySelector('.ws-wave');
        wave.getBoundingClientRect = () => ({left: 0, width: 200, top: 0, height: 28, right: 200, bottom: 28});
        const down = new Event('pointerdown', {bubbles: true, cancelable: true});
        Object.assign(down, {pointerType: 'touch', button: 0, clientX: 100});
        wave.dispatchEvent(down);
        await settle();
        expect(ws.current).toBeNull();
        const tap = new MouseEvent('click', {bubbles: true, clientX: 100});
        wave.dispatchEvent(tap);
        await settle();
        expect(ws.current.title).toBe('Bass Loop 02');
        expect(MockWaveformPlayer.instances[0].calls.seekTo.at(-1)).toBeCloseTo(50);
    });

    it('mouse: a press on a waveform seeks at once', async () => {
        const ws = await make();
        const wave = rows()[2].querySelector('.ws-wave');
        wave.getBoundingClientRect = () => ({left: 0, width: 200, top: 0, height: 28, right: 200, bottom: 28});
        const down = new Event('pointerdown', {bubbles: true, cancelable: true});
        Object.assign(down, {pointerType: 'mouse', button: 0, clientX: 50});
        wave.dispatchEvent(down);
        await settle();
        expect(ws.current.title).toBe('Bass Loop 02');
        expect(MockWaveformPlayer.instances[0].calls.seekTo.at(-1)).toBeCloseTo(25);
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

describe('download links', () => {
    it('a click on the download link does not toggle playback', async () => {
        const ws = new WaveformSounds(host, {sounds: [{url: '/a.mp3', title: 'Kick', download: '/free/kick.wav'}]});
        await ws.ready;
        const link = host.querySelector('.ws-download');
        link.addEventListener('click', (e) => e.preventDefault()); // jsdom would navigate
        link.click();
        await settle();
        expect(ws.current).toBeNull();
        expect(ws.sounds[0].download).toBe('/free/kick.wav');
    });

    it('adopted rows keep their download link', async () => {
        host.innerHTML = renderSoundsElement([{url: '/a.mp3', download: '/free/a.wav'}]);
        const ws = new WaveformSounds(host.firstElementChild);
        await ws.ready;
        expect(ws.sounds[0].download).toBe('/free/a.wav');
    });
});

describe('urlState', () => {
    const at = (q) => history.replaceState(null, '', `/pack${q}`);
    afterEach(() => at(''));

    it('reads the filters and sort from the address on load', async () => {
        at('?q=loop&type=Bass&bpm=125-130&sort=title&other=1');
        const ws = await make({urlState: true});
        expect(ws.filter).toMatchObject({query: 'loop', type: 'Bass', bpmMin: '125', bpmMax: '130'});
        expect(ws.sortBy).toBe('title');
        expect(visibleTitles()).toEqual(['Bass Loop 01']);
        expect(host.querySelector('[data-ws-search]').value).toBe('loop');
        expect(host.querySelector('[data-ws-type="Bass"]').getAttribute('aria-pressed')).toBe('true');
    });

    it('ignores values the data cannot use', async () => {
        at('?type=Nope&sort=bogus&key=Q');
        const ws = await make({urlState: true});
        expect(ws.filter.type).toBe('');
        expect(ws.sortBy).toBe('default');
        expect(visibleTitles()).toHaveLength(4);
    });

    it('writes changes back with replaceState, keeping other parameters', async () => {
        vi.useFakeTimers();
        at('?other=1');
        const before = history.length;
        const ws = new WaveformSounds(host, {sounds: SOUNDS, urlState: true});
        await vi.runAllTimersAsync();
        ws.setFilter({query: 'bass', key: 'Fm'});
        ws.setSort('bpm');
        vi.advanceTimersByTime(300);
        expect(location.search).toBe('?other=1&q=bass&key=Fm&sort=bpm');
        ws.clearFilters();
        vi.advanceTimersByTime(300);
        expect(location.search).toBe('?other=1&sort=bpm');
        expect(history.length).toBe(before);
    });

    it('a string prefixes the parameter names', async () => {
        at('?pack-type=Drums');
        const ws = await make({urlState: 'pack'});
        expect(ws.filter.type).toBe('Drums');
    });

    it('is off by default', async () => {
        at('?type=Drums');
        const ws = await make();
        expect(ws.filter.type).toBe('');
    });
});

describe('keyboard', () => {
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}));

    it('a click on a row title moves focus to its play button, so arrows work next', async () => {
        const ws = await make();
        rows()[1].querySelector('.ws-title').click();
        await settle();
        expect(document.activeElement).toBe(rows()[1].querySelector('.ws-play'));
        key(document.activeElement, 'ArrowDown');
        await settle();
        expect(ws.current.title).toBe('Bass Loop 02');
    });

    it('a mouse seek on a waveform moves focus to that row too', async () => {
        await make();
        const wave = rows()[2].querySelector('.ws-wave');
        wave.getBoundingClientRect = () => ({left: 0, width: 200, top: 0, height: 28, right: 200, bottom: 28});
        const down = new Event('pointerdown', {bubbles: true, cancelable: true});
        Object.assign(down, {pointerType: 'mouse', button: 0, clientX: 50});
        wave.dispatchEvent(down);
        expect(document.activeElement).toBe(rows()[2].querySelector('.ws-play'));
    });

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
        expect(MockWaveformPlayer.instances[0].calls.loadTrack).toHaveLength(0); // nothing playing: just moves
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
