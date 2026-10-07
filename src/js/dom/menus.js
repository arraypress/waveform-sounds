/**
 * The dropdowns (type / key / sort): a button and a popup listbox, with a
 * search field when it has many options. Follows the WAI-ARIA
 * combobox/listbox pattern: focus stays in the search field (or the list),
 * the active option is `aria-activedescendant`, ↑/↓ move, Enter picks,
 * Esc closes and returns focus to the button.
 *
 * A menu without a listbox is a PANEL (the BPM range): a button and a popup
 * dialog of its own controls. It shares the opening, closing, outside-press
 * and Esc handling; what's inside it reports its own changes.
 *
 * The markup comes from `renderMenu()` (server or client); this module
 * only adds behaviour.
 *
 * @module menus
 */

import {fold} from '@arraypress/text';

/**
 * Does an option's label match what's typed in a menu's search field?
 * Case- and accent-insensitive substring.
 *
 * @param {string} label
 * @param {string} query
 * @returns {boolean}
 */
export function optionMatches(label, query) {
    const q = fold(String(query ?? '')).trim();
    return !q || fold(String(label ?? '')).includes(q);
}

/**
 * Move an index by `delta`, clamped to `0..length-1`.
 *
 * @param {number} current - -1 when nothing is active.
 * @param {number} delta
 * @param {number} length
 * @returns {number}
 */
export function stepIndex(current, delta, length) {
    return Math.max(0, Math.min(length - 1, current + delta));
}

/** The parts of one dropdown. */
function partsOf(menu) {
    return {
        button: menu.querySelector('[data-ws-menu-btn]'),
        pop: menu.querySelector('[data-ws-menu-pop]'),
        search: menu.querySelector('[data-ws-menu-search]'),
        list: menu.querySelector('[data-ws-menu-list]'),
        none: menu.querySelector('[data-ws-menu-none]'),
        value: menu.querySelector('[data-ws-menu-value]'),
    };
}

/** The element that owns focus while a menu is open (a panel: its first field, else its first button). */
const focusOwner = (p) => p.search || p.list || p.pop.querySelector('input') || p.pop.querySelector('button');

/** A menu's options, optionally only the ones not filtered out. */
const optionsOf = (p, visibleOnly = false) => [...p.list.querySelectorAll('[role="option"]')].filter((o) => !visibleOnly || !o.hidden);

/**
 * Every dropdown inside one list, with one shared "which is open" state.
 */
export class Menus {
    /**
     * @param {HTMLElement} container - The list's root element.
     * @param {Object} opts
     * @param {(name: string, value: string) => void} opts.onPick - A value was chosen.
     * @param {AbortSignal} opts.signal - Removes every listener on abort.
     */
    constructor(container, {onPick, signal}) {
        this.container = container;
        this.onPick = onPick;
        /** @type {Record<string, HTMLElement>} */
        this.menus = Object.fromEntries([...container.querySelectorAll('[data-ws-menu]')].map((m) => [m.dataset.wsMenu, m]));
        /** @type {HTMLElement|null} */
        this.openMenu = null;
        this._bind(signal);
    }

    /**
     * Wire every menu, plus closing on an outside press or focus leaving.
     * @param {AbortSignal} signal
     * @private
     */
    _bind(signal) {
        const sig = {signal};
        for (const [name, menu] of Object.entries(this.menus)) {
            const p = partsOf(menu);
            p.button.addEventListener('click', () => (this.openMenu === menu ? this.close(true) : this.open(menu)), sig);
            p.button.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.open(menu); }
            }, sig);
            if (!p.list) {
                // A panel: Esc anywhere inside it closes it.
                p.pop.addEventListener('keydown', (e) => {
                    if (e.key !== 'Escape') return;
                    e.preventDefault();
                    e.stopPropagation();
                    this.close(true);
                }, sig);
                continue;
            }
            p.list.addEventListener('click', (e) => {
                const opt = e.target.closest('[role="option"]');
                if (opt) this._pick(name, opt.dataset.value);
            }, sig);
            // Keep focus in the field while an option is pressed.
            p.list.addEventListener('mousedown', (e) => e.preventDefault(), sig);
            p.search?.addEventListener('input', () => this._filter(menu, p.search.value), sig);
            focusOwner(p).addEventListener('keydown', (e) => this._onKey(e, name, menu), sig);
        }
        document.addEventListener('pointerdown', (e) => {
            if (this.openMenu && !this.openMenu.contains(e.target)) this.close(false);
        }, sig);
        this.container.addEventListener('focusout', (e) => {
            if (this.openMenu && !this.openMenu.contains(e.relatedTarget)) this.close(false);
        }, sig);
    }

    /**
     * Open a menu (closing any other), with the selected option active and
     * focus in its search field or list. Flips to open over the end edge
     * when it would overflow the list.
     *
     * @param {HTMLElement} menu
     */
    open(menu) {
        if (this.openMenu && this.openMenu !== menu) this.close(false);
        const p = partsOf(menu);
        p.button.setAttribute('aria-expanded', 'true');
        p.pop.hidden = false;
        this.openMenu = menu;
        if (p.search) { p.search.value = ''; this._filter(menu, ''); }
        menu.classList.remove('ws-menu--end');
        if (p.pop.getBoundingClientRect().right > this.container.getBoundingClientRect().right + 1) menu.classList.add('ws-menu--end');
        if (p.list) this._activate(menu, p.list.querySelector('[role="option"][aria-selected="true"]'));
        focusOwner(p)?.focus();
    }

    /**
     * Close the open menu, if any.
     *
     * @param {boolean} focusButton - Return focus to its button (after a
     *   pick or Esc; not after a click elsewhere).
     */
    close(focusButton) {
        const menu = this.openMenu;
        if (!menu) return;
        this.openMenu = null;
        const p = partsOf(menu);
        p.pop.hidden = true;
        p.button.setAttribute('aria-expanded', 'false');
        if (focusButton) p.button.focus();
    }

    /**
     * Show `value` as a menu's choice (button text + `aria-selected`). Used
     * after a pick and when the filter is changed from code.
     *
     * @param {string} name - 'type' | 'key' | 'sort'.
     * @param {string} value
     */
    setValue(name, value) {
        const menu = this.menus[name];
        if (!menu) return;
        const p = partsOf(menu);
        if (!p.list) return; // a panel shows its own value
        let label = null;
        for (const opt of optionsOf(p)) {
            const on = opt.dataset.value === String(value ?? '');
            opt.setAttribute('aria-selected', String(on));
            if (on) label = opt.querySelector('.ws-menu-text')?.textContent ?? '';
        }
        if (label !== null) p.value.textContent = label;
    }

    /**
     * Narrow a menu to the options matching the search, and make the first
     * match active.
     * @private
     */
    _filter(menu, query) {
        const p = partsOf(menu);
        let first = null;
        for (const opt of optionsOf(p)) {
            opt.hidden = !optionMatches(opt.textContent, query);
            if (!opt.hidden) first ??= opt;
        }
        p.none.hidden = first !== null;
        this._activate(menu, first);
    }

    /**
     * Mark one option active (`aria-activedescendant`) and scroll it into
     * the list's view.
     * @private
     */
    _activate(menu, opt) {
        const p = partsOf(menu);
        for (const o of p.list.querySelectorAll('.is-active')) o.classList.remove('is-active');
        const owner = focusOwner(p);
        if (!opt || opt.hidden) { owner.removeAttribute('aria-activedescendant'); return; }
        opt.classList.add('is-active');
        owner.setAttribute('aria-activedescendant', opt.id);
        opt.scrollIntoView?.({block: 'nearest'});
    }

    /**
     * Keys inside an open menu.
     * @private
     */
    _onKey(e, name, menu) {
        const p = partsOf(menu);
        const opts = optionsOf(p, true);
        const at = opts.indexOf(p.list.querySelector('.is-active'));
        const moveTo = (i) => { e.preventDefault(); this._activate(menu, opts[i]); };
        const inField = e.target.matches('input');
        switch (e.key) {
            case 'ArrowDown': return moveTo(stepIndex(at, 1, opts.length));
            case 'ArrowUp': return moveTo(stepIndex(at, -1, opts.length));
            case 'Home': return inField ? undefined : moveTo(0);
            case 'End': return inField ? undefined : moveTo(opts.length - 1);
            case 'Enter':
                e.preventDefault();
                if (at >= 0) this._pick(name, opts[at].dataset.value);
                return undefined;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                return this.close(true);
            case 'Tab': return this.close(false);
            default: return undefined;
        }
    }

    /**
     * A value was chosen: close, then report it.
     * @private
     */
    _pick(name, value) {
        this.close(true);
        this.onPick(name, value);
    }
}
