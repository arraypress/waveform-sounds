/**
 * WaveformSounds — a searchable, filterable list of sounds for showcasing
 * the previews inside a sample pack, preset bank or sound library.
 *
 * One `WaveformPlayer` (self mode) is the audio engine for the whole list:
 * every sound plays through it, so it brings the player's seeking (incl.
 * hosts that ignore byte ranges), error handling, Media Session card and
 * hand-off with every other player on the page. The rows are light: a
 * button, some text and, in the `inline` layout, a small canvas drawn from
 * low-resolution peaks only when it scrolls into view. 300 sounds is 300
 * rows, not 300 players.
 *
 * Layouts (`player`):
 *   - `'inline'` (default): every row has a mini waveform; the playing row
 *     fills with progress and is click-to-seek. The engine is hidden.
 *   - `'strip'`: plain rows; the engine is shown docked under the list as a
 *     full player for the current sound.
 *
 * This class orchestrates; the pieces live by layer:
 *   - `core/`   — this class, the engine's configuration, the option surface
 *   - `data/`   — pure logic: sounds, filtering, the address, navigation
 *   - `render/` — server-safe markup (also the `/render` entry)
 *   - `dom/`    — browser-only behaviour: dropdowns, rows, canvas, colours
 *   - `shared/` — small helpers
 *
 * @module core
 */

import {availableSorts, facets, matches, normalizeSounds, parseManifest, sortSounds, SORTS} from '../data/sounds.js';
import {drawRowWaveform, resample} from '../dom/draw.js';
import {engineOptions, enginePeaks} from './engine.js';
import {Menus} from '../dom/menus.js';
import {limitToReveal, pageWindow, rowTarget, seekTarget} from '../data/navigation.js';
import {DEFAULT_OPTIONS, mergeOptions, readDataOptions} from './options.js';
import {resolveRenderOptions} from '../render/options.js';
import {renderSounds} from '../render/markup.js';
import {indexRows, orderRows, readRows, visibleRows} from '../dom/rows.js';
import {countText, DEFAULT_STRINGS, fill} from '../render/strings.js';
import {pageSurface, resolveCssColor} from '../dom/colors.js';
import {readUrlState, urlKeys, writeUrlState} from '../data/url-state.js';
import {emit, isTyping, LOG, pointerFraction} from '../shared/utils.js';

export {DEFAULT_OPTIONS};

/** An empty filter: everything matches. */
const NO_FILTER = Object.freeze({query: '', type: '', key: '', bpmMin: '', bpmMax: ''});

/** Debounce for typing in the search box and the BPM fields (ms). */
const SEARCH_DELAY = 120;
const BPM_DELAY = 200;

/** Debounce before the address is rewritten after a change (ms). */
const URL_DELAY = 250;

export class WaveformSounds {
    /** @type {Map<Element, WaveformSounds>} */
    static instances = new Map();

    /**
     * @param {HTMLElement|string} container - The element (or a selector).
     * @param {import('../../../index').WaveformSoundsOptions} [options]
     */
    constructor(container, options = {}) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) throw new Error(`${LOG} Container not found: ${container}`);
        this.container = el;
        // Precedence, as across the family: data-* > constructor > default.
        this.options = mergeOptions(DEFAULT_OPTIONS, options, readDataOptions(el));
        this.options.waveformStyle = this.options.waveformStyle === 'bars' ? 'bars' : 'mirror';
        this.strings = {...DEFAULT_STRINGS, ...(this.options.strings || {})};
        this.render = {...resolveRenderOptions(this.options), strings: this.strings};

        this.sounds = [];
        this.rows = [];
        this.filter = {...NO_FILTER};
        this.sortBy = 'default';
        this.limit = this._pageSize();
        this.currentIndex = null;
        this.playing = false;
        this.progress = 0;
        this.loop = !!this.options.loop;
        this.engine = null;
        this.menus = null;
        this.destroyed = false;
        this._ctl = new AbortController();
        this._originalHTML = null;
        this._pendingSeek = null;
        this._raf = 0;

        WaveformSounds.instances.set(el, this);
        el.dataset.wsInitialized = 'true';
        // Build on a later microtask, never inside the constructor: ready /
        // filter events (and onReady) must reach listeners attached right
        // after `new WaveformSounds()`, and `this.ready` must already exist
        // when they fire. It never rejects: a failed build is reported
        // through onError / `waveformsounds:error`.
        /** Resolves once the list is built (after a manifest fetch, if any). */
        this.ready = Promise.resolve().then(() => this._init()).catch((err) => {
            console.error(`${LOG} Failed to initialise:`, err);
            this._emit('error', {error: err});
            this.options.onError?.(err, this);
        });
    }

    /* ── Setup ─────────────────────────────────────────────────────────── */

    /**
     * Adopt server-rendered markup or render it (from `sounds` or a fetched
     * manifest), then wire everything up.
     * @private
     */
    async _init() {
        const el = this.container;
        const adopted = el.querySelector('[data-ws-list]');
        if (adopted) {
            this.sounds = readRows(adopted);
        } else {
            this._originalHTML = el.innerHTML;
            this.sounds = await this._loadSounds();
            if (this.destroyed) return;
            el.innerHTML = renderSounds(this.sounds, {...this.render, idPrefix: this.options.idPrefix || el.id || undefined});
        }
        if (this.destroyed) return;

        // Remember which classes WE add, so destroy() takes back exactly
        // those (server-rendered markup already carries them).
        this._addedClasses = ['waveform-sounds', `waveform-sounds--${this.render.player}`].filter((c) => !el.classList.contains(c));
        el.classList.add(...this._addedClasses);

        this._cacheRefs();
        this._bind();
        this._observe();
        this._resolveColors();
        this._setLoop(this.loop);

        // The starting order is the first one offered, unless setSort()
        // already chose one; then the address may override both.
        this._sorts = availableSorts(this.render.sorts, facets(this.sounds));
        if (!this._sortSet) this.sortBy = this._sorts[0] || 'default';
        this._readUrl();
        // Show any filter/sort set before now (from code or the address).
        this._syncControls();
        this._apply({resort: this.sortBy !== 'default'});

        // Build the engine now (no audio loads until a play) when the
        // player is on the page, so anything that hooks players on their
        // `waveformplayer:ready` (waveform-tracker, analytics) is attached
        // BEFORE the first play — built on first play, that sound went
        // untracked.
        if (this._playerClass()) this._ensureEngine();

        this._emit('ready', {sounds: this.sounds.length});
        this.options.onReady?.(this);
    }

    /**
     * The sounds from the `sounds` option, else the `manifest` URL.
     * @returns {Promise<import('../../../index').Sound[]>}
     * @private
     */
    async _loadSounds() {
        if (this.options.sounds || !this.options.manifest) return normalizeSounds(this.options.sounds || []);
        const res = await fetch(this.options.manifest);
        if (!res.ok) throw new Error(`${LOG} Manifest ${this.options.manifest}: HTTP ${res.status}`);
        return parseManifest(await res.json());
    }

    /**
     * Look up the elements the runtime drives.
     * @private
     */
    _cacheRefs() {
        const q = (sel) => this.container.querySelector(sel);
        this.$ = {
            list: q('[data-ws-list]'),
            search: q('[data-ws-search]'),
            bpmMin: q('[data-ws-bpm-min]'),
            bpmMax: q('[data-ws-bpm-max]'),
            loop: q('[data-ws-loop]'),
            count: q('[data-ws-count]'),
            empty: q('[data-ws-empty]'),
            more: q('[data-ws-more]'),
            engine: q('[data-ws-engine]'),
            status: q('[data-ws-status]'),
            chips: [...this.container.querySelectorAll('[data-ws-type]')],
        };
        this.rows = indexRows(this.$.list);
    }

    /**
     * Every listener. All are removed by `destroy()` through one
     * AbortController.
     * @private
     */
    _bind() {
        const sig = {signal: this._ctl.signal};
        const $ = this.$;
        const root = this.container;

        root.addEventListener('click', (e) => this._onClick(e), sig);
        root.addEventListener('pointerdown', (e) => this._onPointerDown(e), sig);
        root.addEventListener('keydown', (e) => this._onKey(e), sig);

        let searchTimer = 0, bpmTimer = 0;
        $.search?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.setFilter({query: $.search.value}), SEARCH_DELAY);
        }, sig);
        $.search?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); this._focusRow(visibleRows($.list)[0]); }
            if (e.key === 'Escape' && $.search.value) { e.preventDefault(); $.search.value = ''; this.setFilter({query: ''}); }
        }, sig);
        const onBpm = () => {
            clearTimeout(bpmTimer);
            bpmTimer = setTimeout(() => this.setFilter({bpmMin: $.bpmMin?.value ?? '', bpmMax: $.bpmMax?.value ?? ''}), BPM_DELAY);
        };
        $.bpmMin?.addEventListener('input', onBpm, sig);
        $.bpmMax?.addEventListener('input', onBpm, sig);

        this.menus = new Menus(root, {
            signal: this._ctl.signal,
            onPick: (name, value) => (name === 'sort' ? this.setSort(value) : this.setFilter({[name]: value})),
        });

        // Any OTHER player starting pauses the list (every WaveformPlayer's
        // play event bubbles to the document). The engine's singlePlay only
        // reaches players that also use singlePlay — a WaveformBar's player
        // doesn't, so without this the bar and the list could play at once.
        document.addEventListener('waveformplayer:play', (e) => {
            const player = e.detail?.player;
            if (player && player !== this.engine && this.playing) this.pause();
        }, sig);
    }

    /* ── Input ────────────────────────────────────────────────────────── */

    /**
     * Clicks: type chips, Show more, Clear, Loop, a touch tap on a waveform
     * (seek), and anywhere else on a row (play/pause).
     * @private
     */
    _onClick(e) {
        const t = e.target;
        const chip = t.closest('[data-ws-type]');
        if (chip) { this.setFilter({type: chip.dataset.wsType}); return; }
        if (t.closest('[data-ws-more]')) { this.showMore(); return; }
        if (t.closest('[data-ws-clear]')) { this.clearFilters(); return; }
        if (t.closest('[data-ws-loop]')) { this.setLoop(!this.loop); return; }
        const wave = t.closest('.ws-wave');
        if (wave) {
            // Touch seeks on the TAP (this click): its press may have been
            // the start of a scroll.
            if (this._lastPointer === 'touch') this._seekAt(wave, e.clientX);
            return;
        }
        const row = t.closest('[data-ws-index]');
        if (!row || t.closest('.ws-download')) return;
        this.toggle(Number(row.dataset.wsIndex));
        this._focusRowQuietly(row);
    }

    /**
     * Mouse and pen seek on PRESS, like every scrubber. Remembers the
     * pointer type for the click that follows.
     * @private
     */
    _onPointerDown(e) {
        this._lastPointer = e.pointerType;
        const wave = e.target.closest('.ws-wave');
        if (!wave || e.button !== 0 || e.pointerType === 'touch') return;
        e.preventDefault();
        this._seekAt(wave, e.clientX);
    }

    /**
     * Seek (or start) a row's sound where its waveform was pressed.
     * @private
     */
    _seekAt(wave, clientX) {
        const row = wave.closest('[data-ws-index]');
        this._seekRow(Number(row.dataset.wsIndex), pointerFraction(clientX, wave.getBoundingClientRect()));
        this._focusRowQuietly(row);
    }

    /**
     * Keys on the list: `/` focuses search; ↑/↓/Home/End move between rows
     * (auditioning while something plays); ←/→ seek the playing row.
     * @private
     */
    _onKey(e) {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === '/' && !isTyping(e.target) && this.$.search) {
            e.preventDefault();
            this.$.search.focus();
            return;
        }
        const row = e.target.closest?.('[data-ws-index]');
        if (!row) return;

        const index = Number(row.dataset.wsIndex);
        const seek = seekTarget(this.progress, e.key);
        if (seek !== null) {
            if (index !== this.currentIndex || !this.engine) return;
            e.preventDefault();
            this._seekRow(index, seek);
            return;
        }

        const rows = visibleRows(this.$.list);
        const target = rowTarget(e.key, rows.indexOf(row), rows.length);
        if (target === null) return;
        e.preventDefault();
        if (target === 'search') { this.$.search?.focus(); return; }
        this._focusRow(rows[target]);
        if (this.options.arrowAudition && this.playing) this.play(Number(rows[target].dataset.wsIndex));
    }

    /**
     * Focus a row's play button.
     * @private
     */
    _focusRow(row) {
        row?.querySelector('.ws-play')?.focus();
    }

    /**
     * After a mouse or touch play, put focus on that row's play button so
     * the arrow keys drive the list instead of scrolling the page (a click
     * on the title or waveform left focus on <body>, and Safari never
     * focuses a clicked button). No scroll jump, and no focus ring: the
     * browser shows none for a focus that follows a pointer.
     * @private
     */
    _focusRowQuietly(row) {
        const btn = row?.querySelector('.ws-play');
        if (btn && document.activeElement !== btn) btn.focus({preventScroll: true});
    }

    /* ── Drawing & colours ────────────────────────────────────────────── */

    /**
     * Draw row canvases as they scroll into view; redraw on resize and on
     * theme flips (the canvas can't follow CSS by itself).
     * @private
     */
    _observe() {
        if (this.render.player !== 'inline' || typeof window === 'undefined') return;
        this._drawn = new Set();
        if ('IntersectionObserver' in window) {
            this._io = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const i = Number(entry.target.dataset.wsIndex);
                    this._drawn.add(i);
                    this._drawRow(i);
                }
            }, {rootMargin: '200px 0px'});
            this.rows.forEach((r) => r && this._io.observe(r));
        } else {
            this.rows.forEach((r, i) => r && this._drawn.add(i));
        }
        if ('ResizeObserver' in window) {
            let width = 0;
            this._ro = new ResizeObserver(([entry]) => {
                const w = Math.round(entry.contentRect.width);
                if (w === width) return;
                width = w;
                this._redrawAll();
            });
            this._ro.observe(this.$.list);
        }
        const refresh = () => requestAnimationFrame(() => { this._resolveColors(); this._redrawAll(); });
        this._mo = new MutationObserver(refresh);
        const watch = {attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'style']};
        this._mo.observe(document.documentElement, watch);
        if (document.body) this._mo.observe(document.body, watch);
        try {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh, {signal: this._ctl.signal});
        } catch { /* no matchMedia */ }
    }

    /**
     * Resolve the canvas colours (options, else the CSS custom properties)
     * and keep `--ws-surface` current unless the site set it.
     * @private
     */
    _resolveColors() {
        if (this._autoSurface || !getComputedStyle(this.container).getPropertyValue('--ws-surface').trim()) {
            this._autoSurface = true;
            this.container.style.removeProperty('--ws-surface');
            this.container.style.setProperty('--ws-surface', pageSurface(this.container));
        }
        this.colors = {
            wave: this.options.waveformColor || resolveCssColor(this.container, 'var(--ws-wave-color)') || 'rgba(128,128,128,.5)',
            progress: this.options.progressColor || resolveCssColor(this.container, 'var(--ws-progress-color)') || 'currentColor',
        };
    }

    /**
     * Draw one row's waveform (only once it has been on screen).
     * @private
     */
    _drawRow(index) {
        if (this.render.player !== 'inline' || index == null || !this._drawn?.has(index)) return;
        const row = this.rows[index];
        const canvas = row?.querySelector('canvas');
        if (!canvas || row.hidden) return;
        const gap = Number(this.options.barGap);
        drawRowWaveform(canvas, this.sounds[index].peaks, index === this.currentIndex ? this.progress : 0, {
            style: this.options.waveformStyle,
            color: this.colors?.wave || 'rgba(128,128,128,.5)',
            progressColor: this.colors?.progress || 'currentColor',
            barWidth: Math.max(1, Number(this.options.barWidth) || 2),
            barGap: Number.isFinite(gap) ? Math.max(0, gap) : 1,
        });
    }

    /**
     * Redraw every row drawn so far.
     * @private
     */
    _redrawAll() {
        this._drawn?.forEach((i) => this._drawRow(i));
    }

    /* ── Filters in the address ───────────────────────────────────────── */

    /**
     * Apply the filter and sort from the address (`urlState`).
     * @private
     */
    _readUrl() {
        const keys = urlKeys(this.options.urlState);
        if (!keys || typeof location === 'undefined') return;
        const {filter, sort} = readUrlState(location.search, keys, facets(this.sounds), this._sorts);
        this.filter = {...this.filter, ...filter};
        if (sort) { this.sortBy = sort; this._sortSet = true; }
    }

    /**
     * Rewrite the address shortly after a change (replaceState: no history
     * entries).
     * @private
     */
    _queueUrl() {
        const keys = urlKeys(this.options.urlState);
        if (!keys || typeof location === 'undefined') return;
        clearTimeout(this._urlTimer);
        this._urlTimer = setTimeout(() => {
            if (this.destroyed) return;
            const next = writeUrlState(location.href, keys, this.filter, this.sortBy, this._sorts?.[0] || 'default');
            if (next !== location.href) history.replaceState(history.state, '', next);
        }, URL_DELAY);
    }

    /* ── Filtering, sorting, paging ───────────────────────────────────── */

    /** The sounds that pass the filter, in the current sort order. */
    get visible() {
        return sortSounds(this.sounds.filter((s) => matches(s, this.filter)), this.sortBy);
    }

    /**
     * Change the filter (merged into the current one) and re-apply. Back to
     * the first page.
     *
     * @param {Partial<import('../../../index').SoundsFilter>} patch
     */
    setFilter(patch = {}) {
        this.filter = {...this.filter, ...patch};
        this.limit = this._pageSize();
        this._syncControls();
        this._apply({resort: false});
    }

    /** Reset every filter (the sort stays). */
    clearFilters() {
        this.setFilter(NO_FILTER);
    }

    /** @param {import('../../../index').SoundsSort} by */
    setSort(by) {
        this._sortSet = true;
        this.sortBy = SORTS.includes(by) ? by : 'default';
        this.menus?.setValue('sort', this.sortBy);
        this._apply({resort: true});
    }

    /** Reveal the next page of results. */
    showMore() {
        if (this.limit === Infinity) return;
        this.limit += this.render.pageSize;
        this._apply({resort: false});
    }

    /**
     * Rows per page (Infinity when paging is off).
     * @private
     */
    _pageSize() {
        return this.render.pageSize > 0 ? this.render.pageSize : Infinity;
    }

    /**
     * Show the current filter and sort in the controls (they can be set from
     * code or the address, not only by the controls themselves).
     * @private
     */
    _syncControls() {
        const $ = this.$, f = this.filter;
        if (!$) return;
        if ($.search && $.search.value !== f.query) $.search.value = f.query;
        this.menus?.setValue('type', f.type || '');
        this.menus?.setValue('key', f.key || '');
        this.menus?.setValue('sort', this.sortBy);
        if ($.bpmMin && $.bpmMin.value !== String(f.bpmMin)) $.bpmMin.value = f.bpmMin;
        if ($.bpmMax && $.bpmMax.value !== String(f.bpmMax)) $.bpmMax.value = f.bpmMax;
        $.chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.wsType === (f.type || ''))));
    }

    /**
     * Lay the rows out for the current filter, sort and page: order, hide,
     * "Show more", the empty state and the count. Then report it.
     *
     * @param {{resort: boolean}} opts - Reorder the rows even if the sort
     *   hasn't changed.
     * @private
     */
    _apply({resort}) {
        const $ = this.$;
        if (!$) return;
        if (resort || this.sortBy !== this._lastSort) {
            orderRows($.list, sortSounds(this.sounds, this.sortBy).map((s) => this.rows[this.sounds.indexOf(s)]));
            this._lastSort = this.sortBy;
        }
        const shown = this.visible;
        const {visible, remaining} = pageWindow(shown, this.limit);
        this.sounds.forEach((s, i) => { if (this.rows[i]) this.rows[i].hidden = !visible.has(s); });
        if ($.more) {
            $.more.hidden = remaining <= 0;
            $.more.textContent = fill(this.strings.showMore, {count: Math.min(remaining, this.render.pageSize || remaining)});
        }
        if ($.empty) $.empty.hidden = shown.length > 0;
        if ($.count) $.count.textContent = countText(shown.length, this.sounds.length, this.strings);
        this._queueUrl();
        this._emit('filter', {visible: shown.length, total: this.sounds.length, filter: {...this.filter}, sort: this.sortBy});
        this.options.onFilter?.(shown, this);
    }

    /* ── Playback ─────────────────────────────────────────────────────── */

    /**
     * Resolve an index, id or sound to an index in `this.sounds`. No
     * target means the current sound, else the first visible one.
     *
     * @param {number|string|Object} [target]
     * @returns {number|null}
     * @private
     */
    _indexOf(target) {
        if (target == null) return this.currentIndex ?? (this.visible[0] ? this.sounds.indexOf(this.visible[0]) : null);
        if (typeof target === 'number') return this.sounds[target] ? target : null;
        const i = typeof target === 'object' ? this.sounds.indexOf(target) : this.sounds.findIndex((s) => s.id === String(target));
        return i >= 0 ? i : null;
    }

    /**
     * The WaveformPlayer class: `playerClass`, else the page's global.
     * @returns {Function|null}
     * @private
     */
    _playerClass() {
        return this.options.playerClass || (typeof window !== 'undefined' ? window.WaveformPlayer : null) || null;
    }

    /**
     * Build the engine once (it holds no audio until a play).
     * @returns {Object|null} The engine, or null without a player class.
     * @private
     */
    _ensureEngine() {
        if (this.engine) return this.engine;
        const Player = this._playerClass();
        if (!Player) {
            console.error(`${LOG} @arraypress/waveform-player is required: load it before playing (or pass playerClass).`);
            return null;
        }
        this.engine = new Player(this.$.engine, engineOptions(this.options.playerOptions, this.render.player, {
            onLoad: () => this._onEngineLoad(),
            onPlay: () => this._setPlaying(true),
            onPause: () => this._setPlaying(false),
            onEnd: () => this._onEnd(),
            onTimeUpdate: (time, duration) => this._onTime(time, duration),
            onError: (err) => this._onEngineError(err),
        }));
        return this.engine;
    }

    /**
     * Play a sound (by index, id or sound object), or resume the current
     * one. Before the list is built the call waits for it.
     *
     * @param {number|string|Object} [target]
     * @param {{at?: number}} [opts] - `at`: start position 0..1.
     */
    play(target, opts = {}) {
        if (!this.$) { this.ready.then(() => { if (!this.destroyed) this.play(target, opts); }); return; }
        const index = this._indexOf(target);
        if (index == null) return;
        const engine = this._ensureEngine();
        if (!engine) return;
        if (index === this.currentIndex && engine.audio?.src) {
            if (opts.at != null) this._seekRow(index, opts.at);
            if (!this.playing) engine.play();
            return;
        }
        const previous = this.currentIndex;
        this.currentIndex = index;
        this.progress = 0;
        this._pendingSeek = opts.at ?? null;
        if (previous != null) this._paintRow(previous);
        this._paintRow(index);
        const sound = this.sounds[index];
        engine.loadTrack(sound.url, sound.title, sound.type || null, {waveform: enginePeaks(sound, this.render.player), autoplay: true});
    }

    /** Pause the current sound. */
    pause() {
        if (this.engine && this.playing) this.engine.pause();
    }

    /**
     * The current sound plays/pauses; another sound starts.
     * @param {number|string|Object} [target]
     */
    toggle(target) {
        const index = this._indexOf(target);
        if (index == null) return;
        if (index === this.currentIndex && this.playing) this.pause();
        else this.play(index);
    }

    /** Play the next visible sound (no wrap at the end). */
    next() { this._step(1); }

    /** Play the previous visible sound. */
    previous() { this._step(-1); }

    /**
     * Play the visible sound `dir` places away, revealing it if it's past
     * the current page.
     *
     * @param {1|-1} dir
     * @returns {boolean} Whether there was one.
     * @private
     */
    _step(dir) {
        const shown = this.visible;
        const at = this.currentIndex == null ? -1 : shown.indexOf(this.sounds[this.currentIndex]);
        const target = shown[at + dir];
        if (!target) return false;
        const limit = limitToReveal(this.limit, at + dir);
        if (limit !== this.limit) { this.limit = limit; this._apply({resort: false}); }
        this.play(this.sounds.indexOf(target));
        return true;
    }

    /**
     * Loop the current sound (auditioning a loop is the common case).
     * @param {boolean} on
     */
    setLoop(on) {
        this.loop = !!on;
        this._setLoop(this.loop);
    }

    /**
     * Apply the loop state to the toggle and the engine.
     * @private
     */
    _setLoop(on) {
        this.$?.loop?.setAttribute('aria-pressed', String(on));
        if (this.engine?.audio) this.engine.audio.loop = on;
    }

    /**
     * Seek a row's sound to `fraction`; a row that isn't current starts
     * there. Before the duration is known the seek waits for it.
     * @private
     */
    _seekRow(index, fraction) {
        if (index !== this.currentIndex || !this.engine) { this.play(index, {at: fraction}); return; }
        const duration = this.engine.audio?.duration;
        if (!Number.isFinite(duration) || duration <= 0) { this._pendingSeek = fraction; return; }
        this.engine.seekTo(fraction * duration);
        this.progress = fraction;
        this._paintRow(index);
        if (!this.playing) this.engine.play();
    }

    /**
     * The engine loaded a sound: apply the loop, borrow decoded peaks for a
     * row that had none, and land a pending seek.
     * @private
     */
    _onEngineLoad() {
        if (this.engine?.audio) this.engine.audio.loop = this.loop;
        const sound = this.sounds[this.currentIndex];
        if (sound && !sound.peaks && this.engine?.waveformData?.length) {
            sound.peaks = resample(this.engine.waveformData, 96);
            this._drawRow(this.currentIndex);
        }
        const duration = this.engine?.audio?.duration;
        if (this._pendingSeek != null && Number.isFinite(duration) && duration > 0) {
            this.engine.seekTo(this._pendingSeek * duration);
            this.progress = this._pendingSeek;
            this._pendingSeek = null;
        }
    }

    /**
     * Playback progress: repaint the current row, once per frame.
     * @private
     */
    _onTime(time, duration) {
        if (this.currentIndex == null || !duration) return;
        if (this._pendingSeek != null) {
            const fraction = this._pendingSeek;
            this._pendingSeek = null;
            this.engine.seekTo(fraction * duration);
            return;
        }
        this.progress = Math.min(Math.max(time / duration, 0), 1);
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this._drawRow(this.currentIndex);
            this.rows[this.currentIndex]?.querySelector('.ws-wave')?.setAttribute('aria-valuenow', String(Math.round(this.progress * 100)));
        });
    }

    /**
     * A sound finished: report it, then auto-advance or settle.
     * @private
     */
    _onEnd() {
        const sound = this.sounds[this.currentIndex];
        this._emit('end', {sound, index: this.currentIndex});
        this.options.onEnd?.(sound, this);
        if (this.options.autoAdvance && this._step(1)) return;
        this.progress = 0;
        this._setPlaying(false);
    }

    /**
     * A sound failed to load or play: mark its row and report it.
     * @private
     */
    _onEngineError(err) {
        this.rows[this.currentIndex]?.classList.add('is-error');
        this._emit('error', {error: err, sound: this.sounds[this.currentIndex], index: this.currentIndex});
        this.options.onError?.(err, this);
    }

    /**
     * Record play/pause and repaint. Events fire only on a real change: at a
     * natural end the browser fires `pause` then `ended`, and `_onEnd()`
     * also settles the state — one pause event, not two.
     * @private
     */
    _setPlaying(on) {
        const changed = this.playing !== on;
        this.playing = on;
        const index = this.currentIndex;
        if (index == null) return;
        this._paintRow(index);
        if (!changed) return;
        const sound = this.sounds[index];
        if (on && this.$.status) this.$.status.textContent = fill(this.strings.nowPlaying, {title: sound.title});
        this._emit(on ? 'play' : 'pause', {sound, index});
        (on ? this.options.onPlay : this.options.onPause)?.(sound, this);
    }

    /* ── Row painting ─────────────────────────────────────────────────── */

    /**
     * A row's state classes, play-button label and waveform.
     * @private
     */
    _paintRow(index) {
        const row = this.rows[index];
        if (!row) return;
        const current = index === this.currentIndex;
        const on = current && this.playing;
        row.classList.toggle('is-current', current);
        row.classList.toggle('is-playing', on);
        const btn = row.querySelector('.ws-play');
        if (btn) {
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', fill(on ? this.strings.pause : this.strings.play, {title: this.sounds[index].title}));
        }
        const wave = row.querySelector('.ws-wave');
        if (wave) {
            wave.tabIndex = current ? 0 : -1;
            if (!current) wave.setAttribute('aria-valuenow', '0');
        }
        this._drawRow(index);
    }

    /* ── Events & lifecycle ──────────────────────────────────────────── */

    /**
     * Emit a `waveformsounds:<name>` event carrying this instance.
     * @private
     */
    _emit(name, detail = {}) {
        emit(this.container, name, {...detail, instance: this});
    }

    /** The sound playing (or paused) now, or null. */
    get current() {
        return this.currentIndex == null ? null : this.sounds[this.currentIndex];
    }

    /**
     * Tear down: listeners, observers, timers and the engine. Markup this
     * instance rendered is restored to what the container held before.
     * ADOPTED (server-rendered) markup is left as it is now — rows may be
     * re-sorted, hidden or marked current — so to start again, re-render it
     * rather than constructing a new instance over it.
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this._ctl.abort();
        this._io?.disconnect();
        this._ro?.disconnect();
        this._mo?.disconnect();
        if (this._raf) cancelAnimationFrame(this._raf);
        clearTimeout(this._urlTimer);
        try { this.engine?.destroy(); } catch { /* engine already gone */ }
        this.engine = null;
        if (this._originalHTML != null) this.container.innerHTML = this._originalHTML;
        if (this._addedClasses?.length) this.container.classList.remove(...this._addedClasses);
        if (this._autoSurface) this.container.style.removeProperty('--ws-surface');
        delete this.container.dataset.wsInitialized;
        WaveformSounds.instances.delete(this.container);
    }

    /**
     * Initialise every `[data-waveform-sounds]` under `root` that isn't yet.
     *
     * @param {ParentNode} [root=document]
     * @returns {WaveformSounds[]} The new instances.
     */
    static init(root = document) {
        if (typeof document === 'undefined') return [];
        const scope = root || document;
        const els = [...(scope.matches?.('[data-waveform-sounds]') ? [scope] : []), ...scope.querySelectorAll('[data-waveform-sounds]')];
        const created = [];
        for (const el of els) {
            if (el.dataset.wsInitialized === 'true' || WaveformSounds.instances.has(el)) continue;
            try { created.push(new WaveformSounds(el)); } catch (err) { console.error(`${LOG} Failed to initialise:`, err, el); }
        }
        return created;
    }

    /**
     * The instance on an element (or selector), if any.
     * @param {Element|string} el
     * @returns {WaveformSounds|null}
     */
    static getInstance(el) {
        const node = typeof el === 'string' ? document.querySelector(el) : el;
        return node ? WaveformSounds.instances.get(node) || null : null;
    }

    /** Destroy instances whose element has left the document (after a
     *  client-side navigation). */
    static prune() {
        for (const [el, inst] of WaveformSounds.instances) if (!el.isConnected) inst.destroy();
    }
}
