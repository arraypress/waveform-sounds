import {describe, it, expect, beforeAll, afterAll, afterEach, vi} from 'vitest';
// The REAL core, from the package, so this runs against what a consumer
// installs. test/setup.js put the mock on `window`; importing the package
// replaces it, and beforeAll re-asserts it so this file can't silently
// fall back to the mock.
import {WaveformPlayer} from '@arraypress/waveform-player';
import {WaveformSounds} from '../src/js/entry.js';

/**
 * jsdom has no media pipeline, so <audio> gets just enough behaviour for
 * the core's lifecycle: play/pause fire their events, `load()` resets the
 * duration, and the test delivers `loadedmetadata` by hand. (The same shim
 * as waveform-playlist's integration test.)
 */
const media = HTMLMediaElement.prototype;
const saved = {};

beforeAll(() => {
    window.WaveformPlayer = WaveformPlayer;
    for (const key of ['play', 'pause', 'load', 'duration', 'paused']) saved[key] = Object.getOwnPropertyDescriptor(media, key);
    Object.defineProperty(media, 'duration', {configurable: true, get() { return this._duration ?? NaN; }});
    Object.defineProperty(media, 'paused', {configurable: true, get() { return this._paused ?? true; }});
    media.play = function () { this._paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); };
    media.pause = function () { if (this._paused === false) { this._paused = true; this.dispatchEvent(new Event('pause')); } };
    media.load = function () { this._duration = NaN; };
    saved.getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null;
    saved.matchMedia = window.matchMedia;
    window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
    for (const [key, desc] of Object.entries(saved)) {
        if (key === 'getContext') HTMLCanvasElement.prototype.getContext = desc;
        else if (key === 'matchMedia') window.matchMedia = desc;
        else if (desc) Object.defineProperty(media, key, desc);
    }
    vi.restoreAllMocks();
});

afterEach(() => {
    WaveformSounds.instances.forEach((i) => i.destroy());
    document.body.innerHTML = '';
});

const SOUNDS = [
    {url: '/a.mp3', title: 'A', type: 'Bass', peaks: '20406080'},
    {url: '/b.mp3', title: 'B', type: 'Drums', peaks: '80604020'},
];

async function mount(options = {}) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ws = new WaveformSounds(el, {sounds: SOUNDS, ...options});
    await ws.ready;
    return {el, ws};
}

/** Deliver metadata for the engine's current source. */
function metadata(ws, duration = 8) {
    const audio = ws.engine.audio;
    audio._duration = duration;
    audio.dispatchEvent(new Event('loadedmetadata'));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('against the real WaveformPlayer', () => {
    it('constructs the engine lazily, in self mode, without errors', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const {ws} = await mount();
        expect(ws.engine).toBeNull();
        ws.play(0);
        expect(ws.engine).toBeInstanceOf(WaveformPlayer);
        expect(ws.engine.options.audioMode).toBe('self');
        await flush();
        metadata(ws);
        await flush(); await flush();
        expect(err).not.toHaveBeenCalled();
        err.mockRestore();
    });

    it('plays the requested sound through loadTrack, and the row follows the engine', async () => {
        const {el, ws} = await mount();
        ws.play(1);
        await flush();
        expect(ws.engine.audio.src).toContain('/b.mp3');
        metadata(ws);
        await flush(); await flush();
        expect(ws.playing).toBe(true);
        expect(el.querySelector('[data-ws-index="1"]').classList.contains('is-playing')).toBe(true);
        ws.engine.pause();
        expect(ws.playing).toBe(false);
    });

    it('switching sounds reuses the one engine', async () => {
        const {ws} = await mount();
        ws.play(0);
        const engine = ws.engine;
        await flush(); metadata(ws); await flush();
        ws.play(1);
        await flush(); metadata(ws); await flush();
        expect(ws.engine).toBe(engine);
        expect(ws.engine.audio.src).toContain('/b.mp3');
        expect(WaveformPlayer.getAllInstances()).toHaveLength(1);
    });

    it('hands off with another player on the page (singlePlay)', async () => {
        const other = document.createElement('div');
        document.body.appendChild(other);
        const player = new WaveformPlayer(other, {url: '/other.mp3', waveform: [0.5, 0.5]});
        const {ws} = await mount();
        player.play();
        expect(WaveformPlayer.currentlyPlaying).toBe(player);
        ws.play(0);
        await flush(); metadata(ws); await flush(); await flush();
        expect(player.isPlaying).toBe(false);
        player.destroy();
    });

    it('another player starting pauses the list, even without singlePlay', async () => {
        const other = document.createElement('div');
        document.body.appendChild(other);
        const player = new WaveformPlayer(other, {url: '/other.mp3', waveform: [0.5, 0.5], singlePlay: false});
        const {ws} = await mount();
        ws.play(0);
        await flush(); metadata(ws); await flush(); await flush();
        expect(ws.playing).toBe(true);
        player.play();
        expect(ws.playing).toBe(false);
        player.destroy();
    });

    it('a strip layout shows the engine as a player in the list', async () => {
        const {el, ws} = await mount({player: 'strip'});
        ws.play(0);
        await flush();
        const slot = el.querySelector('[data-ws-engine]');
        expect(slot.hidden).toBe(false);
        expect(slot.querySelector('canvas')).not.toBeNull();
    });

    it('destroy() tears the engine down', async () => {
        const {ws} = await mount();
        ws.play(0);
        await flush();
        ws.destroy();
        expect(WaveformPlayer.getAllInstances()).toHaveLength(0);
    });
});
