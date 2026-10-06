import {describe, it, expect, vi} from 'vitest';
import {optionMatches, stepIndex, Menus} from '../../../src/js/dom/menus.js';
import {renderMenu} from '../../../src/js/render/markup.js';

describe('pure helpers', () => {
    it('optionMatches: folded substring; empty query matches all', () => {
        expect(optionMatches('Bass loops', 'LOOP')).toBe(true);
        expect(optionMatches('Ébène', 'eben')).toBe(true);
        expect(optionMatches('Bass', 'kick')).toBe(false);
        expect(optionMatches('Bass', '  ')).toBe(true);
    });
    it('stepIndex clamps', () => {
        expect(stepIndex(-1, 1, 3)).toBe(0);
        expect(stepIndex(2, 1, 3)).toBe(2);
        expect(stepIndex(0, -1, 3)).toBe(0);
    });
});

describe('Menus', () => {
    function mount() {
        const root = document.createElement('div');
        root.innerHTML = renderMenu('type', {
            id: 't', label: 'Type', value: '', placeholder: 'Find…', searchFrom: 1, noMatches: 'None',
            options: [{value: '', label: 'All'}, {value: 'Bass', label: 'Bass'}, {value: 'Drums', label: 'Drums'}],
        });
        document.body.appendChild(root);
        const onPick = vi.fn();
        const ctl = new AbortController();
        const menus = new Menus(root, {onPick, signal: ctl.signal});
        return {root, menus, onPick, ctl, menu: root.querySelector('[data-ws-menu]')};
    }

    it('opens, filters, picks with the keyboard and reports it', () => {
        const {root, menus, onPick, ctl, menu} = mount();
        menus.open(menu);
        const search = menu.querySelector('[data-ws-menu-search]');
        expect(document.activeElement).toBe(search);
        search.value = 'dru';
        search.dispatchEvent(new Event('input'));
        search.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
        expect(onPick).toHaveBeenCalledWith('type', 'Drums');
        expect(menus.openMenu).toBeNull();
        ctl.abort(); root.remove();
    });

    it('setValue updates the button and aria-selected', () => {
        const {root, menus, ctl, menu} = mount();
        menus.setValue('type', 'Bass');
        expect(menu.querySelector('[data-ws-menu-value]').textContent).toBe('Bass');
        expect(menu.querySelector('[data-value="Bass"]').getAttribute('aria-selected')).toBe('true');
        expect(menu.querySelector('[data-value=""]').getAttribute('aria-selected')).toBe('false');
        ctl.abort(); root.remove();
    });

    it('aborting the signal removes its listeners', () => {
        const {root, menus, ctl, menu} = mount();
        ctl.abort();
        menu.querySelector('[data-ws-menu-btn]').click();
        expect(menus.openMenu).toBeNull();
        root.remove();
    });
});
