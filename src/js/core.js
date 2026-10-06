/**
 * WaveformSounds — a searchable, filterable list of sounds for showcasing
 * the previews inside a sample pack, preset bank or sound library.
 *
 * One `WaveformPlayer` (self mode) is the audio engine for the whole list:
 * every sound plays through it, so it brings the player's seeking (incl.
 * hosts that ignore byte ranges), error handling, Media Session card and
 * `singlePlay` hand-off with every other player on the page (a persistent
 * WaveformBar included). The rows are light: a button, some text and, in
 * the `inline` layout, a small canvas drawn from low-resolution peaks only
 * when it scrolls into view. 300 sounds is 300 rows, not 300 players.
 *
 * Layouts (`player`):
 *   - `'inline'` (default): every row has a mini waveform; the playing row
 *     fills with progress and is click-to-seek. The engine is hidden.
 *   - `'strip'`: plain rows; the engine is shown docked under the list as a
 *     full player for the current sound.
 *
 * @module core
 */

import {
    decodePeaks, facets, matches, normalizeSound, normalizeSounds, parseManifest, sortSounds, SORTS,
} from './data.js';
import {countText, DEFAULT_STRINGS, fill, renderSounds, RENDER_DEFAULTS, resolveRenderOptions} from './render.js';
import {drawRowWaveform, resample} from './draw.js';

const LOG = '[WaveformSounds]';

/** Every option, with its default. `index.d.ts` documents each one. */
export const DEFAULT_OPTIONS = {
    ...RENDER_DEFAULTS,
    sounds: null,
    manifest: null,
    waveformStyle: 'mirror',
    waveformColor: null,
    progressColor: null,
    barWidth: 2,
    barGap: 1,
    loop: false,
    autoAdvance: false,
    arrowAudition: true,
    playerOptions: null,
    playerClass: null,
    strings: null,
    onReady: null,
    onPlay: null,
    onPause: null,
    onEnd: null,
    onFilter: null,
    onError: null,
};

/** Options read from `data-*` on the container (kebab-case). */
function readDataOptions(el) {
    const d = el.dataset || {};
    const out = {};
    const bool = (v) => (v === '' || v === 'true' ? true : v === 'false' ? false : undefined);
    const list = (v) => (v == null ? undefined : v.split(',').map((x) => x.trim()).filter(Boolean));
    if (d.player) out.player = d.player;
    if (d.manifest) out.manifest = d.manifest;
    if (d.search !== undefined) out.search = bool(d.search);
    if (d.filters !== undefined) out.filters = list(d.filters);
    if (d.sortable !== undefined) out.sortable = bool(d.sortable);
    if (d.loopToggle !== undefined) out.loopToggle = bool(d.loopToggle);
    if (d.pageSize !== undefined && d.pageSize !== '') out.pageSize = Number(d.pageSize);
    if (d.maxTypeChips !== undefined && d.maxTypeChips !== '') out.maxTypeChips = Number(d.maxTypeChips);
    if (d.columns !== undefined) out.columns = list(d.columns);
    if (d.waveformStyle) out.waveformStyle = d.waveformStyle;
    if (d.waveformColor) out.waveformColor = d.waveformColor;
    if (d.progressColor) out.progressColor = d.progressColor;
    if (d.barWidth !== undefined && d.barWidth !== '') out.barWidth = Number(d.barWidth);
    if (d.barGap !== undefined && d.barGap !== '') out.barGap = Number(d.barGap);
    if (d.loop !== undefined) out.loop = bool(d.loop);
    if (d.autoAdvance !== undefined) out.autoAdvance = bool(d.autoAdvance);
    if (d.arrowAudition !== undefined) out.arrowAudition = bool(d.arrowAudition);
    // Object options as JSON, for server-rendered markup (wrappers).
    const json = (v, name) => { try { return JSON.parse(v); } catch { console.warn(`${LOG} Ignoring invalid JSON in data-${name}`); return undefined; } };
    if (d.strings) out.strings = json(d.strings, 'strings');
    if (d.playerOptions) out.playerOptions = json(d.playerOptions, 'player-options');
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
}

/** Later sources win; null/undefined never overwrite. */
function merge(...sources) {
    const out = {};
    for (const src of sources) {
        if (!src) continue;
        for (const k in src) if (src[k] !== null && src[k] !== undefined) out[k] = src[k];
    }
    return out;
}

const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));

export class WaveformSounds {
    /** @type {Map<Element, WaveformSounds>} */
    static instances = new Map();

    /**
     * @param {HTMLElement|string} container - The element (or a selector).
     * @param {import('../../index').WaveformSoundsOptions} [options]
     */
    constructor(container, options = {}) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) throw new Error(`${LOG} Container not found: ${container}`);
        this.container = el;
        // Precedence, as across the family: data-* > constructor > default.
        this.options = merge(DEFAULT_OPTIONS, options, readDataOptions(el));
        this.options.waveformStyle = this.options.waveformStyle === 'bars' ? 'bars' : 'mirror';
        this.render = resolveRenderOptions(this.options);
        this.strings = {...DEFAULT_STRINGS, ...(this.options.strings || {})};
        this.render.strings = this.strings;

        this.sounds = [];
        this.rows = [];
        this.filter = {query: '', type: '', key: '', bpmMin: '', bpmMax: ''};
        this.sortBy = 'default';
        this.limit = this.render.pageSize > 0 ? this.render.pageSize : Infinity;
        this.currentIndex = null;
        this.playing = false;
        this.progress = 0;
        this.loop = !!this.options.loop;
        this.engine = null;
        this.destroyed = false;
        this._ctl = new AbortController();
        this._originalHTML = null;
        this._pendingSeek = null;
        this._raf = 0;

        WaveformSounds.instances.set(el, this);
        el.dataset.wsInitialized = 'true';
        /** Resolves once the list is built (after a manifest fetch, if any). */
        // Build on a later microtask, never inside the constructor: ready /
        // filter events (and onReady) must reach listeners attached right
        // after `new WaveformSounds()`, and `this.ready` must already exist
        // when they fire.
        this.ready = Promise.resolve().then(() => this._init()).catch((err) => {
            console.error(`${LOG} Failed to initialise:`, err);
            this._emit('error', {error: err});
            if (typeof this.options.onError === 'function') this.options.onError(err, this);
        });
    }

    /* ── Setup ─────────────────────────────────────────────────────────── */

    async _init() {
        const el = this.container;
        const adopted = el.querySelector('[data-ws-list]');
        if (adopted) {
            this.sounds = this._readRows(adopted);
        } else {
            this._originalHTML = el.innerHTML;
            let list = this.options.sounds;
            if (!list && this.options.manifest) {
                const res = await fetch(this.options.manifest);
                if (!res.ok) throw new Error(`${LOG} Manifest ${this.options.manifest}: HTTP ${res.status}`);
                list = parseManifest(await res.json());
            } else {
                list = normalizeSounds(list || []);
            }
            if (this.destroyed) return;
            this.sounds = list;
            el.innerHTML = renderSounds(list, {...this.render, strings: this.strings});
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
        // A setFilter()/setSort() made before the list existed: show it in
        // the controls, and lay the rows out in that order.
        this._syncControls();
        if (this.$.sort && this.$.sort.value !== this.sortBy) this.$.sort.value = this.sortBy;
        this._apply({resort: this.sortBy !== 'default'});
        this._emit('ready', {sounds: this.sounds.length});
        if (typeof this.options.onReady === 'function') this.options.onReady(this);
    }

    /**
     * Server-rendered rows → sounds. Rows are taken in their original
     * order (data-ws-index) and renumbered 0..n-1, so a row dropped from
     * the markup (or one without a url) can't leave a hole that would
     * misalign rows and sounds.
     */
    _readRows(list) {
        const rows = [...list.querySelectorAll(':scope > [data-ws-index]')]
            .sort((a, b) => Number(a.dataset.wsIndex) - Number(b.dataset.wsIndex));
        const out = [];
        for (const row of rows) {
            const d = row.dataset;
            const s = normalizeSound({
                id: d.wsId, url: d.url, title: d.title, type: d.type, bpm: d.bpm, key: d.key,
                duration: d.duration, tags: d.tags, peaks: d.peaks, waveform: d.waveform,
            }, out.length);
            if (!s) { row.remove(); continue; }
            row.dataset.wsIndex = String(out.length);
            out.push(s);
        }
        return out;
    }

    _cacheRefs() {
        const q = (sel) => this.container.querySelector(sel);
        this.$ = {
            list: q('[data-ws-list]'),
            search: q('[data-ws-search]'),
            key: q('[data-ws-key]'),
            typeSelect: q('[data-ws-type-select]'),
            bpmMin: q('[data-ws-bpm-min]'),
            bpmMax: q('[data-ws-bpm-max]'),
            sort: q('[data-ws-sort]'),
            loop: q('[data-ws-loop]'),
            count: q('[data-ws-count]'),
            empty: q('[data-ws-empty]'),
            more: q('[data-ws-more]'),
            engine: q('[data-ws-engine]'),
            status: q('[data-ws-status]'),
            chips: [...this.container.querySelectorAll('[data-ws-type]')],
        };
        this.rows = [];
        this.$.list.querySelectorAll(':scope > [data-ws-index]').forEach((row) => {
            this.rows[Number(row.dataset.wsIndex)] = row;
        });
    }

    _bind() {
        const sig = {signal: this._ctl.signal};
        const $ = this.$;
        const root = this.container;

        root.addEventListener('click', (e) => {
            const t = e.target;
            const chip = t.closest('[data-ws-type]');
            if (chip) return this.setFilter({type: chip.dataset.wsType});
            if (t.closest('[data-ws-more]')) return this.showMore();
            if (t.closest('[data-ws-clear]')) return this.clearFilters();
            if (t.closest('[data-ws-loop]')) return this.setLoop(!this.loop);
            const row = t.closest('[data-ws-index]');
            if (!row || t.closest('.ws-wave')) return;
            this.toggle(Number(row.dataset.wsIndex));
        }, sig);

        // Seek on the row waveform. Pointer, not click: a press should
        // land where it went down, like every scrubber.
        root.addEventListener('pointerdown', (e) => {
            const wave = e.target.closest('.ws-wave');
            if (!wave || e.button !== 0) return;
            const row = wave.closest('[data-ws-index]');
            const r = wave.getBoundingClientRect();
            const pct = r.width ? Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) : 0;
            e.preventDefault();
            this._seekRow(Number(row.dataset.wsIndex), pct);
        }, sig);

        let tSearch = 0, tBpm = 0;
        $.search?.addEventListener('input', () => {
            clearTimeout(tSearch);
            tSearch = setTimeout(() => this.setFilter({query: $.search.value}), 120);
        }, sig);
        $.search?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); this._focusRow(this._visibleRows()[0]); }
            if (e.key === 'Escape' && $.search.value) { e.preventDefault(); $.search.value = ''; this.setFilter({query: ''}); }
        }, sig);
        $.key?.addEventListener('change', () => this.setFilter({key: $.key.value}), sig);
        $.typeSelect?.addEventListener('change', () => this.setFilter({type: $.typeSelect.value}), sig);
        const bpm = () => { clearTimeout(tBpm); tBpm = setTimeout(() => this.setFilter({bpmMin: $.bpmMin?.value ?? '', bpmMax: $.bpmMax?.value ?? ''}), 200); };
        $.bpmMin?.addEventListener('input', bpm, sig);
        $.bpmMax?.addEventListener('input', bpm, sig);
        $.sort?.addEventListener('change', () => this.setSort($.sort.value), sig);

        root.addEventListener('keydown', (e) => this._onKey(e), sig);

        // Any OTHER player starting (every WaveformPlayer's play event
        // bubbles to the document) pauses the list. The engine's
        // singlePlay only covers players that also use singlePlay: a
        // WaveformBar's player doesn't, so without this the bar and the
        // list could play at once.
        document.addEventListener('waveformplayer:play', (e) => {
            const p = e.detail?.player;
            if (p && p !== this.engine && this.playing) this.pause();
        }, sig);
    }

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
        const visible = this._visibleRows();
        const at = visible.indexOf(row);
        const go = (r) => {
            if (!r) return;
            e.preventDefault();
            this._focusRow(r);
            if (this.options.arrowAudition && this.playing) this.play(Number(r.dataset.wsIndex));
        };
        switch (e.key) {
            case 'ArrowDown': return go(visible[at + 1]);
            case 'ArrowUp': return at > 0 ? go(visible[at - 1]) : (e.preventDefault(), this.$.search?.focus());
            case 'Home': return go(visible[0]);
            case 'End': return go(visible[visible.length - 1]);
            case 'ArrowRight':
            case 'ArrowLeft': {
                if (index !== this.currentIndex || !this.engine) return;
                e.preventDefault();
                const step = e.key === 'ArrowRight' ? 0.1 : -0.1;
                this._seekRow(index, Math.min(Math.max(this.progress + step, 0), 0.999));
                return;
            }
            default:
        }
    }

    /** Draw row canvases when they scroll into view; redraw on resize/theme. */
    _observe() {
        if (this.render.player !== 'inline' || typeof window === 'undefined') return;
        this._drawn = new Set();
        if ('IntersectionObserver' in window) {
            this._io = new IntersectionObserver((entries) => {
                for (const en of entries) {
                    if (!en.isIntersecting) continue;
                    const i = Number(en.target.dataset.wsIndex);
                    this._drawn.add(i);
                    this._drawRow(i);
                }
            }, {rootMargin: '200px 0px'});
            this.rows.forEach((r) => r && this._io.observe(r));
        } else {
            this.rows.forEach((r, i) => r && this._drawn.add(i));
        }
        if ('ResizeObserver' in window) {
            let w = 0;
            this._ro = new ResizeObserver(([en]) => {
                const nw = Math.round(en.contentRect.width);
                if (nw === w) return;
                w = nw;
                this._redrawAll();
            });
            this._ro.observe(this.$.list);
        }
        // Theme flips (class / data-theme on <html> or <body>, OS scheme):
        // the canvas can't follow CSS, so re-read the colours and redraw.
        const refresh = () => requestAnimationFrame(() => { this._resolveColors(); this._redrawAll(); });
        this._mo = new MutationObserver(refresh);
        const attrs = {attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'style']};
        this._mo.observe(document.documentElement, attrs);
        if (document.body) this._mo.observe(document.body, attrs);
        try {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener('change', refresh, {signal: this._ctl.signal});
        } catch { /* no matchMedia */ }
    }

    /** Canvas colours: the options, else the CSS custom properties. */
    _resolveColors() {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
        this.container.appendChild(probe);
        const read = (v) => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
        this.colors = {
            wave: this.options.waveformColor || read('var(--ws-wave-color)') || 'rgba(128,128,128,.5)',
            progress: this.options.progressColor || read('var(--ws-progress-color)') || 'currentColor',
        };
        probe.remove();
    }

    /* ── Filtering, sorting, paging ───────────────────────────────────── */

    /** The sounds that pass the filter, in the current sort order. */
    get visible() {
        return sortSounds(this.sounds.filter((s) => matches(s, this.filter)), this.sortBy);
    }

    /**
     * Change the filter (merged into the current one) and re-apply.
     * @param {Partial<import('../../index').SoundsFilter>} patch
     */
    setFilter(patch = {}) {
        this.filter = {...this.filter, ...patch};
        this.limit = this.render.pageSize > 0 ? this.render.pageSize : Infinity;
        this._syncControls();
        this._apply({resort: false});
    }

    /** Reset every filter (the sort stays). */
    clearFilters() {
        this.setFilter({query: '', type: '', key: '', bpmMin: '', bpmMax: ''});
    }

    /** @param {'default'|'title'|'bpm'|'key'|'duration'} by */
    setSort(by) {
        this.sortBy = SORTS.includes(by) ? by : 'default';
        if (this.$?.sort && this.$.sort.value !== this.sortBy) this.$.sort.value = this.sortBy;
        this._apply({resort: true});
    }

    /** Reveal the next page of results. */
    showMore() {
        if (this.limit === Infinity) return;
        this.limit += this.render.pageSize;
        this._apply({resort: false});
    }

    /** Keep the controls in step when the filter is set from code. */
    _syncControls() {
        const $ = this.$, f = this.filter;
        if (!$) return;
        if ($.search && $.search.value !== f.query) $.search.value = f.query;
        if ($.key && $.key.value !== f.key) $.key.value = f.key;
        if ($.typeSelect && $.typeSelect.value !== (f.type || '')) $.typeSelect.value = f.type || '';
        if ($.bpmMin && $.bpmMin.value !== String(f.bpmMin)) $.bpmMin.value = f.bpmMin;
        if ($.bpmMax && $.bpmMax.value !== String(f.bpmMax)) $.bpmMax.value = f.bpmMax;
        $.chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.wsType === (f.type || ''))));
    }

    _apply({resort}) {
        const $ = this.$;
        if (!$) return;
        const shown = this.visible;
        if (resort || this.sortBy !== this._lastSort) {
            // Reorder every row (hidden ones too) so un-filtering keeps the order.
            const order = sortSounds(this.sounds, this.sortBy);
            const frag = document.createDocumentFragment();
            for (const s of order) {
                const row = this.rows[this.sounds.indexOf(s)];
                if (row) frag.appendChild(row);
            }
            $.list.appendChild(frag);
            this._lastSort = this.sortBy;
        }
        const visibleSet = new Set();
        shown.forEach((s, i) => { if (i < this.limit) visibleSet.add(s); });
        this.sounds.forEach((s, i) => {
            const row = this.rows[i];
            if (row) row.hidden = !visibleSet.has(s);
        });
        const remaining = shown.length - visibleSet.size;
        if ($.more) {
            $.more.hidden = remaining <= 0;
            $.more.textContent = fill(this.strings.showMore, {count: Math.min(remaining, this.render.pageSize || remaining)});
        }
        if ($.empty) $.empty.hidden = shown.length > 0;
        if ($.count) $.count.textContent = countText(shown.length, this.sounds.length, this.strings);
        this._emit('filter', {visible: shown.length, total: this.sounds.length, filter: {...this.filter}, sort: this.sortBy});
        if (typeof this.options.onFilter === 'function') this.options.onFilter(shown, this);
    }

    _visibleRows() {
        return [...this.$.list.children].filter((r) => r.matches('[data-ws-index]') && !r.hidden);
    }

    _focusRow(row) {
        row?.querySelector('.ws-play')?.focus();
    }

    /* ── Playback ─────────────────────────────────────────────────────── */

    /** Resolve an index, id or sound to an index in `this.sounds`. */
    _indexOf(target) {
        if (target == null) return this.currentIndex ?? (this.visible[0] ? this.sounds.indexOf(this.visible[0]) : null);
        if (typeof target === 'number') return this.sounds[target] ? target : null;
        if (typeof target === 'object') { const i = this.sounds.indexOf(target); return i >= 0 ? i : null; }
        const i = this.sounds.findIndex((s) => s.id === String(target));
        return i >= 0 ? i : null;
    }

    _ensureEngine() {
        if (this.engine) return this.engine;
        const Player = this.options.playerClass || (typeof window !== 'undefined' ? window.WaveformPlayer : null);
        if (!Player) {
            console.error(`${LOG} @arraypress/waveform-player is required: load it before playing (or pass playerClass).`);
            return null;
        }
        const user = this.options.playerOptions || {};
        const strip = this.render.player === 'strip';
        const call = (name, ...args) => { if (typeof user[name] === 'function') user[name](...args); };
        this.engine = new Player(this.$.engine, {
            height: strip ? 48 : 32,
            waveformStyle: strip ? 'mirror' : 'bars',
            preload: 'metadata',
            singlePlay: true,
            ...user,
            audioMode: 'self',
            onLoad: (p) => { this._onEngineLoad(); call('onLoad', p); },
            onPlay: (p) => { this._setPlaying(true); call('onPlay', p); },
            onPause: (p) => { this._setPlaying(false); call('onPause', p); },
            onEnd: (p) => { this._onEnd(); call('onEnd', p); },
            onTimeUpdate: (t, d, p) => { this._onTime(t, d); call('onTimeUpdate', t, d, p); },
            onError: (err, p) => { this._onEngineError(err); call('onError', err, p); },
        });
        return this.engine;
    }

    /**
     * Play a sound (by index, id or sound object), or resume the current one.
     * @param {number|string|Object} [target]
     * @param {{at?: number}} [opts] - `at`: start position 0..1.
     */
    play(target, opts = {}) {
        // Before the list exists there is nothing to resolve `target`
        // against: play once it's built instead of dropping the call.
        if (!this.$) { this.ready.then(() => { if (!this.destroyed) this.play(target, opts); }); return; }
        const index = this._indexOf(target);
        if (index == null) return;
        const engine = this._ensureEngine();
        if (!engine) return;
        const sound = this.sounds[index];
        if (index === this.currentIndex && engine.audio && engine.audio.src) {
            if (opts.at != null) this._seekRow(index, opts.at);
            if (!this.playing) engine.play();
            return;
        }
        const prev = this.currentIndex;
        this.currentIndex = index;
        this.progress = 0;
        this._pendingSeek = opts.at != null ? opts.at : null;
        if (prev != null) this._paintRow(prev);
        this._paintRow(index);
        const strip = this.render.player === 'strip';
        // Peaks for the engine: in the strip a full sidecar if there is
        // one; else the row's peaks. Supplied peaks also stop a hidden
        // engine from downloading and decoding the file just to draw them.
        const waveform = (strip && sound.waveform) || sound.peaks || null;
        engine.loadTrack(sound.url, sound.title, sound.type || null, {waveform, autoplay: true});
    }

    /** Pause the current sound. */
    pause() {
        if (this.engine && this.playing) this.engine.pause();
    }

    /** Toggle: the current sound plays/pauses; another sound starts. */
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

    _step(dir) {
        const shown = this.visible;
        const cur = this.currentIndex == null ? -1 : shown.indexOf(this.sounds[this.currentIndex]);
        const nextSound = shown[cur + dir];
        if (!nextSound) return false;
        const i = this.sounds.indexOf(nextSound);
        // Reveal it if it's past the current page.
        const pos = shown.indexOf(nextSound);
        if (pos >= this.limit) { this.limit = pos + 1; this._apply({resort: false}); }
        this.play(i);
        return true;
    }

    /** Loop the current sound (auditioning a loop is the common case). */
    setLoop(on) {
        this.loop = !!on;
        this._setLoop(this.loop);
    }

    _setLoop(on) {
        if (this.$?.loop) this.$.loop.setAttribute('aria-pressed', String(on));
        if (this.engine?.audio) this.engine.audio.loop = on;
    }

    _seekRow(index, pct) {
        if (index !== this.currentIndex || !this.engine) return this.play(index, {at: pct});
        const d = this.engine.audio?.duration;
        if (!Number.isFinite(d) || d <= 0) { this._pendingSeek = pct; return; }
        this.engine.seekTo(pct * d);
        this.progress = pct;
        this._paintRow(index);
        if (!this.playing) this.engine.play();
    }

    _onEngineLoad() {
        if (this.engine?.audio) this.engine.audio.loop = this.loop;
        const sound = this.sounds[this.currentIndex];
        // A sound with no peaks of its own borrows the ones the engine
        // decoded, so its row stops showing a flat line.
        if (sound && !sound.peaks && Array.isArray(this.engine?.waveformData) && this.engine.waveformData.length) {
            sound.peaks = resample(this.engine.waveformData, 96);
            this._drawRow(this.currentIndex);
        }
        if (this._pendingSeek != null) {
            const pct = this._pendingSeek;
            const d = this.engine.audio?.duration;
            if (Number.isFinite(d) && d > 0) { this._pendingSeek = null; this.engine.seekTo(pct * d); this.progress = pct; }
        }
    }

    _onTime(t, d) {
        if (this.currentIndex == null || !d) return;
        if (this._pendingSeek != null) { const p = this._pendingSeek; this._pendingSeek = null; this.engine.seekTo(p * d); return; }
        this.progress = Math.min(Math.max(t / d, 0), 1);
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this._drawRow(this.currentIndex);
            const wave = this.rows[this.currentIndex]?.querySelector('.ws-wave');
            if (wave) wave.setAttribute('aria-valuenow', String(Math.round(this.progress * 100)));
        });
    }

    _onEnd() {
        const sound = this.sounds[this.currentIndex];
        this._emit('end', {sound, index: this.currentIndex});
        if (typeof this.options.onEnd === 'function') this.options.onEnd(sound, this);
        if (this.options.autoAdvance && this._step(1)) return;
        this.progress = 0;
        this._setPlaying(false);
    }

    _onEngineError(err) {
        const row = this.rows[this.currentIndex];
        if (row) row.classList.add('is-error');
        const sound = this.sounds[this.currentIndex];
        this._emit('error', {error: err, sound, index: this.currentIndex});
        if (typeof this.options.onError === 'function') this.options.onError(err, this);
    }

    _setPlaying(on) {
        // Events only on a real change: at a natural end the browser fires
        // `pause` then `ended`, and _onEnd() also settles the state — one
        // pause event, not two.
        const changed = this.playing !== on;
        this.playing = on;
        const index = this.currentIndex;
        if (index == null) return;
        this._paintRow(index);
        if (!changed) return;
        const sound = this.sounds[index];
        if (on) {
            if (this.$.status) this.$.status.textContent = fill(this.strings.nowPlaying, {title: sound.title});
            this._emit('play', {sound, index});
            if (typeof this.options.onPlay === 'function') this.options.onPlay(sound, this);
        } else {
            this._emit('pause', {sound, index});
            if (typeof this.options.onPause === 'function') this.options.onPause(sound, this);
        }
    }

    /* ── Row painting ─────────────────────────────────────────────────── */

    /** State classes, button label and the waveform of one row. */
    _paintRow(index) {
        const row = this.rows[index];
        if (!row) return;
        const current = index === this.currentIndex;
        const on = current && this.playing;
        row.classList.toggle('is-current', current);
        row.classList.toggle('is-playing', on);
        const btn = row.querySelector('.ws-play');
        const title = this.sounds[index].title;
        if (btn) {
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', fill(on ? this.strings.pause : this.strings.play, {title}));
        }
        const wave = row.querySelector('.ws-wave');
        if (wave) {
            wave.tabIndex = current ? 0 : -1;
            if (!current) wave.setAttribute('aria-valuenow', '0');
        }
        this._drawRow(index);
    }

    _drawRow(index) {
        if (this.render.player !== 'inline' || index == null || !this._drawn?.has(index)) return;
        const row = this.rows[index];
        const canvas = row?.querySelector('canvas');
        if (!canvas || row.hidden) return;
        drawRowWaveform(canvas, this.sounds[index].peaks, index === this.currentIndex ? this.progress : 0, {
            style: this.options.waveformStyle,
            color: this.colors?.wave || 'rgba(128,128,128,.5)',
            progressColor: this.colors?.progress || 'currentColor',
            barWidth: Math.max(1, Number(this.options.barWidth) || 2),
            barGap: Number.isFinite(Number(this.options.barGap)) ? Math.max(0, Number(this.options.barGap)) : 1,
        });
    }

    _redrawAll() {
        this._drawn?.forEach((i) => this._drawRow(i));
    }

    /* ── Events & lifecycle ──────────────────────────────────────────── */

    _emit(name, detail = {}) {
        this.container.dispatchEvent(new CustomEvent(`waveformsounds:${name}`, {
            bubbles: true,
            detail: {...detail, instance: this},
        }));
    }

    /** The sound playing (or paused) now, or null. */
    get current() {
        return this.currentIndex == null ? null : this.sounds[this.currentIndex];
    }

    /** Tear down: listeners, observers and the engine. Markup this instance
     *  rendered is restored to what the container held before. ADOPTED
     *  (server-rendered) markup is left as it is now — rows may be re-sorted,
     *  hidden or marked current — so to start again, re-render it rather
     *  than constructing a new instance over it. */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this._ctl.abort();
        this._io?.disconnect();
        this._ro?.disconnect();
        this._mo?.disconnect();
        if (this._raf) cancelAnimationFrame(this._raf);
        try { this.engine?.destroy(); } catch { /* engine already gone */ }
        this.engine = null;
        if (this._originalHTML != null) this.container.innerHTML = this._originalHTML;
        if (this._addedClasses?.length) this.container.classList.remove(...this._addedClasses);
        delete this.container.dataset.wsInitialized;
        WaveformSounds.instances.delete(this.container);
    }

    /**
     * Initialise every `[data-waveform-sounds]` under `root` that isn't yet.
     * @param {ParentNode} [root=document]
     * @returns {WaveformSounds[]} The new instances.
     */
    static init(root = document) {
        if (typeof document === 'undefined') return [];
        const out = [];
        const scope = root || document;
        const els = [...(scope.matches?.('[data-waveform-sounds]') ? [scope] : []), ...scope.querySelectorAll('[data-waveform-sounds]')];
        for (const el of els) {
            if (el.dataset.wsInitialized === 'true' || WaveformSounds.instances.has(el)) continue;
            try { out.push(new WaveformSounds(el)); } catch (err) { console.error(`${LOG} Failed to initialise:`, err, el); }
        }
        return out;
    }

    /** The instance on an element (or selector), if any. */
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

export {decodePeaks, facets};
