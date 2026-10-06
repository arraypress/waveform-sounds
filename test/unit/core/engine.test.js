// @vitest-environment node
import {describe, it, expect, vi} from 'vitest';
import {engineOptions, enginePeaks} from '../../../src/js/core/engine.js';

describe('engineOptions', () => {
    it('defaults by layout; the site overrides; audioMode is always self', () => {
        expect(engineOptions(null, 'inline', {})).toMatchObject({height: 32, waveformStyle: 'bars', singlePlay: true, audioMode: 'self'});
        expect(engineOptions({height: 80, audioMode: 'external'}, 'strip', {})).toMatchObject({height: 80, waveformStyle: 'mirror', audioMode: 'self'});
    });
    it("the list's callbacks always run, then the site's", () => {
        const order = [];
        const opts = engineOptions({onPlay: (p) => order.push(`site:${p}`)}, 'inline', {onPlay: (p) => order.push(`list:${p}`)});
        opts.onPlay('x');
        expect(order).toEqual(['list:x', 'site:x']);
    });
    it('a callback the list does not handle still reaches the site', () => {
        const onError = vi.fn();
        engineOptions({onError}, 'inline', {}).onError('boom');
        expect(onError).toHaveBeenCalledWith('boom');
    });
});

describe('enginePeaks', () => {
    const sound = {peaks: [0.5], waveform: '/full.json'};
    it('strip prefers the full sidecar; inline the row peaks', () => {
        expect(enginePeaks(sound, 'strip')).toBe('/full.json');
        expect(enginePeaks(sound, 'inline')).toEqual([0.5]);
        expect(enginePeaks({peaks: null, waveform: null}, 'strip')).toBeNull();
    });
});
