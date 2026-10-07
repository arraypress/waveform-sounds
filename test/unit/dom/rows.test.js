import {describe, it, expect} from 'vitest';
import {readRows, indexRows, visibleRows, orderRows} from '../../../src/js/dom/rows.js';
import {renderSounds} from '../../../src/js/render/markup.js';

function listOf(sounds) {
    const root = document.createElement('div');
    root.innerHTML = renderSounds(sounds, {pageSize: 0});
    return root.querySelector('[data-ws-list]');
}

describe('rows', () => {
    const SOUNDS = [{url: '/a.mp3', title: 'A', bpm: 120, download: '/a.wav'}, {url: '/b.mp3', title: 'B'}, {url: '/c.mp3', title: 'C'}];

    it('readRows rebuilds the sounds from the markup', () => {
        const sounds = readRows(listOf(SOUNDS));
        expect(sounds.map((s) => s.title)).toEqual(['A', 'B', 'C']);
        expect(sounds[0]).toMatchObject({bpm: 120, download: '/a.wav'});
    });

    it('readRows keeps which sounds are loops', () => {
        const sounds = readRows(listOf([{url: '/a.mp3', loop: true}, {url: '/b.mp3'}]));
        expect(sounds.map((s) => s.loop)).toEqual([true, false]);
    });

    it('readRows renumbers around a missing or unusable row', () => {
        const list = listOf(SOUNDS);
        list.querySelector('[data-ws-index="0"]').removeAttribute('data-url');
        const sounds = readRows(list);
        expect(sounds.map((s) => s.title)).toEqual(['B', 'C']);
        expect([...list.children].map((r) => r.dataset.wsIndex)).toEqual(['0', '1']);
    });

    it('indexRows maps by sound index whatever the display order; orderRows reorders', () => {
        const list = listOf(SOUNDS);
        const rows = indexRows(list);
        orderRows(list, [rows[2], rows[0], rows[1]]);
        expect([...list.children].map((r) => r.dataset.title)).toEqual(['C', 'A', 'B']);
        expect(indexRows(list)[2].dataset.title).toBe('C');
    });

    it('visibleRows skips hidden rows, in display order', () => {
        const list = listOf(SOUNDS);
        indexRows(list)[1].hidden = true;
        expect(visibleRows(list).map((r) => r.dataset.title)).toEqual(['A', 'C']);
    });
});
