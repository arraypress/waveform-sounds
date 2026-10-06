/**
 * @arraypress/waveform-sounds — hand-written types.
 *
 * The four `waveform-sounds-*` wrappers derive their prop types from
 * `WaveformSoundsOptions` here. Add or rename an option in `src/js/core/options.js`
 * (`DEFAULT_OPTIONS`) and in this file in the same change.
 */

/** One sound, as given (a manifest entry, a `sounds` item). */
export interface SoundInput {
    /** Audio URL. Required. */
    url: string;
    /** Display name. Defaults to the file name. */
    title?: string;
    /** Kind of sound ("Drum loops", "Bass", "One-shots"): the type chips. */
    type?: string;
    /** Tempo. Enables the BPM range filter and sort. */
    bpm?: number | string;
    /** Musical key, any common spelling ("F minor", "Fmin", "F#"). Shown
     *  and filtered in a short canonical form ("Fm", "F#"). */
    key?: string;
    /** Length: seconds (8.02) or "m:ss". */
    duration?: number | string;
    /** Extra words the search matches. */
    tags?: string[] | string;
    /** Low-resolution peaks for the row waveform: an 8-bit hex string
     *  (two characters per bar, what `waveform-gen --manifest` writes) or
     *  numbers 0..1. Without them the row shows a flat line until played. */
    peaks?: string | number[];
    /** Full-resolution peaks for the `strip` player (a waveform-gen `.json`
     *  URL or an array). */
    waveform?: string | number[];
    /** Optional download link for this sound (a free sample, the `.mid` of
     *  a MIDI preview). Rows with one get a download button; rows without
     *  carry nothing. A plain `<a download>`: gating is the site's job. */
    download?: string;
    /** Stable id for `play('id')`. Defaults to `sound-<n>`, 1-based
     *  (`sound-1` is the first sound). */
    id?: string;
}

/** A sound after normalisation (what the runtime holds). */
export interface Sound {
    id: string;
    url: string;
    title: string;
    type: string;
    bpm: number | null;
    key: string;
    duration: number | null;
    tags: string[];
    peaks: number[] | null;
    waveform: string | null;
    download: string | null;
}

/** What `waveform-gen --manifest` writes (a bare array also works). */
export interface SoundsManifest {
    version?: number;
    /** Scale of integer `peaks` arrays (e.g. 100). Ignored for hex peaks. */
    peakScale?: number;
    sounds: SoundInput[];
}

export interface SoundsFilter {
    /** Words matched (all of them, any order) against title, type, key and
     *  tags; a number also matches the BPM exactly. */
    query: string;
    /** One type, or '' for all. */
    type: string;
    /** One key, or '' for any. */
    key: string;
    bpmMin: number | string;
    bpmMax: number | string;
}

export type SoundsSort = 'default' | 'title' | 'bpm' | 'key' | 'duration';
export type SoundsLayout = 'inline' | 'strip';
export type SoundsFilterControl = 'type' | 'key' | 'bpm';
export type SoundsColumn = 'type' | 'bpm' | 'key' | 'duration';

/** Every visible or announced word. `{title}`, `{count}`, `{total}` are filled in. */
export interface WaveformSoundsStrings {
    search: string;
    searchPlaceholder: string;
    all: string;
    types: string;
    key: string;
    anyKey: string;
    allTypes: string;
    findType: string;
    findKey: string;
    noMatches: string;
    bpm: string;
    bpmMin: string;
    bpmMax: string;
    sort: string;
    sortBy: string;
    sortDefault: string;
    sortTitle: string;
    sortBpm: string;
    sortKey: string;
    sortDuration: string;
    loop: string;
    play: string;
    pause: string;
    seek: string;
    download: string;
    count: string;
    countOne: string;
    countFiltered: string;
    showMore: string;
    empty: string;
    clear: string;
    nowPlaying: string;
}

export interface WaveformSoundsOptions {
    /** The sounds. Or `manifest`, or server-rendered rows in the container. */
    sounds?: SoundInput[] | null;
    /** URL of a sounds manifest (JSON), fetched when there are no `sounds`
     *  and no server-rendered rows. */
    manifest?: string | null;
    /** `'inline'` (default): a mini waveform per row, the playing row fills
     *  and seeks. `'strip'`: plain rows and one full player docked below. */
    player?: SoundsLayout;
    /** Show the search box. Default true. */
    search?: boolean;
    /** Which filter controls to offer (each appears only when the data has
     *  something to filter: 2+ types, 2+ keys, a BPM range). Drop one to
     *  remove it, e.g. `['type']` for no key or BPM filtering — and leave
     *  it out of `columns` and `sorts` to remove it everywhere. `[]` = no
     *  filters. */
    filters?: SoundsFilterControl[];
    /** The sort orders the Sort menu offers, in order; the first is the
     *  starting order. Orders the data can't use are dropped (no BPM sort
     *  without BPMs). `[]` (or one usable order) hides the menu.
     *  Default `['default', 'title', 'bpm', 'key', 'duration']`. */
    sorts?: SoundsSort[];
    /** Show the "12 of 300 sounds" count. Default true. */
    showCount?: boolean;
    /** A dropdown (type / key / sort) gets a search field when it has more
     *  than this many options. Default 8. */
    menuSearch?: number;
    /** Prefix for the dropdowns' element ids. Default: the container's `id`,
     *  else a hash of the sounds — so two lists of the SAME sounds on one
     *  page each need one (or an `id`). Wrappers pass a framework-unique id. */
    idPrefix?: string;
    /** Keep the filters in the address (`?q=bass&type=Bass+loops&key=Fm&
     *  bpm=120-130&sort=bpm`), so a filtered list can be shared and survives
     *  a refresh. `true` uses those names; a string prefixes them
     *  (`'pack'` → `pack-q`, `pack-type`, …) for several lists on a page.
     *  Uses replaceState: filtering adds no history entries. Default false. */
    urlState?: boolean | string;
    /** Show the Loop toggle. Default true. */
    loopToggle?: boolean;
    /** Up to this many types show as chips; more become a "Type" menu
     *  (a pack has a handful, a whole library can have fifty). Default 10. */
    maxTypeChips?: number;
    /** Rows shown before "Show more" (0 = all). Default 50. */
    pageSize?: number;
    /** Columns after the title, in order. Default all four. */
    columns?: SoundsColumn[];
    /** Row waveform style. Default `'mirror'`. */
    waveformStyle?: 'mirror' | 'bars';
    /** Row waveform colour. Default: CSS `--ws-wave-color`. */
    waveformColor?: string | null;
    /** Played-part colour. Default: CSS `--ws-progress-color` (the accent). */
    progressColor?: string | null;
    /** Row bar width in CSS px. Default 2. */
    barWidth?: number;
    /** Gap between row bars in CSS px. Default 1. */
    barGap?: number;
    /** Start with Loop on. Default false. */
    loop?: boolean;
    /** Play the next visible sound when one ends. Default false. */
    autoAdvance?: boolean;
    /** While a sound plays, ↑/↓ move to the next row AND play it (the
     *  sample-browser audition). Default true. */
    arrowAudition?: boolean;
    /** Options for the engine `WaveformPlayer` (colours, height, … — and its
     *  callbacks, which are called alongside the list's own). `audioMode` is
     *  always `'self'`. As markup: `data-player-options` (JSON). */
    playerOptions?: Record<string, unknown> | null;
    /** The `WaveformPlayer` class, for ESM setups without the global. */
    playerClass?: unknown;
    /** UI strings (partial: merged over the English defaults). As markup:
     *  `data-strings='{"count":"{count} geluiden"}'` (JSON). */
    strings?: Partial<WaveformSoundsStrings> | null;
    onReady?: ((instance: WaveformSounds) => void) | null;
    onPlay?: ((sound: Sound, instance: WaveformSounds) => void) | null;
    onPause?: ((sound: Sound, instance: WaveformSounds) => void) | null;
    onEnd?: ((sound: Sound, instance: WaveformSounds) => void) | null;
    /** After every filter/sort/page change, with the matching sounds. */
    onFilter?: ((visible: Sound[], instance: WaveformSounds) => void) | null;
    onError?: ((error: unknown, instance: WaveformSounds) => void) | null;
}

/** `detail` of the `waveformsounds:*` DOM events (all bubble). */
export interface WaveformSoundsEventMap {
    'waveformsounds:ready': CustomEvent<{sounds: number; instance: WaveformSounds}>;
    'waveformsounds:play': CustomEvent<{sound: Sound; index: number; instance: WaveformSounds}>;
    'waveformsounds:pause': CustomEvent<{sound: Sound; index: number; instance: WaveformSounds}>;
    'waveformsounds:end': CustomEvent<{sound: Sound; index: number; instance: WaveformSounds}>;
    'waveformsounds:filter': CustomEvent<{visible: number; total: number; filter: SoundsFilter; sort: SoundsSort; instance: WaveformSounds}>;
    'waveformsounds:error': CustomEvent<{error: unknown; sound?: Sound; index?: number; instance: WaveformSounds}>;
}

export declare class WaveformSounds {
    constructor(container: HTMLElement | string, options?: WaveformSoundsOptions);
    readonly container: HTMLElement;
    readonly options: Required<WaveformSoundsOptions>;
    /** Resolves once the list is built (after a manifest fetch, if any).
     *  The build always happens after the constructor returns, so listeners
     *  attached straight after `new WaveformSounds()` see `ready`. It never
     *  rejects: a failed build (e.g. the manifest 404s) resolves it too and
     *  is reported through `onError` / `waveformsounds:error`. Calls made
     *  before it resolves are honoured: `setFilter`/`setSort` show in the
     *  controls once built, and `play()` waits for the list. */
    readonly ready: Promise<void>;
    readonly sounds: Sound[];
    readonly filter: SoundsFilter;
    readonly sortBy: SoundsSort;
    readonly playing: boolean;
    /** The engine `WaveformPlayer`, created on first play. */
    readonly engine: unknown;
    /** The sounds passing the filter, in sort order. */
    readonly visible: Sound[];
    /** The current (playing or paused) sound. */
    readonly current: Sound | null;

    play(target?: number | string | Sound, opts?: {at?: number}): void;
    pause(): void;
    toggle(target?: number | string | Sound): void;
    next(): void;
    previous(): void;
    setLoop(on: boolean): void;
    setFilter(patch: Partial<SoundsFilter>): void;
    clearFilters(): void;
    setSort(by: SoundsSort): void;
    showMore(): void;
    /** Tear down listeners, observers and the engine. Markup the instance
     *  rendered is restored; ADOPTED server markup is left as it is (rows may
     *  be re-sorted/hidden) — re-render it before building a new instance. */
    destroy(): void;

    static instances: Map<Element, WaveformSounds>;
    static init(root?: ParentNode): WaveformSounds[];
    static getInstance(el: Element | string): WaveformSounds | null;
    /** Destroy instances whose element has left the document. */
    static prune(): void;
    static DEFAULT_OPTIONS: WaveformSoundsOptions;
    static DEFAULT_STRINGS: WaveformSoundsStrings;
    static utils: {
        encodePeaks: typeof encodePeaks;
        decodePeaks: typeof decodePeaks;
        normalizeKey: typeof normalizeKey;
        normalizeSounds: typeof normalizeSounds;
        parseManifest: typeof parseManifest;
        facets: typeof facets;
        matches: typeof matches;
        sortSounds: typeof sortSounds;
        formatDuration: typeof formatDuration;
        renderSounds: typeof renderSounds;
    };
}

export declare const DEFAULT_OPTIONS: WaveformSoundsOptions;
export declare const DEFAULT_STRINGS: WaveformSoundsStrings;
export declare function encodePeaks(peaks: number[]): string;
export declare function decodePeaks(value: string | number[] | null | undefined, scale?: number): number[] | null;
export declare function normalizeKey(key: string | null | undefined): string;
export declare function normalizeSounds(list: SoundInput[], peakScale?: number): Sound[];
export declare function parseManifest(manifest: SoundsManifest | SoundInput[]): Sound[];
export declare function facets(sounds: Sound[]): {types: {name: string; count: number}[]; keys: string[]; bpm: {min: number; max: number} | null; hasDuration: boolean};
export declare function matches(sound: Sound, filter?: Partial<SoundsFilter>): boolean;
export declare function sortSounds(sounds: Sound[], by?: SoundsSort): Sound[];
export declare function formatDuration(seconds: number | null | undefined): string;
/** The component's inner markup, for server rendering (also exported, DOM-free, from `@arraypress/waveform-sounds/render`). */
export declare function renderSounds(sounds: SoundInput[], options?: WaveformSoundsOptions): string;
/** The whole element (wrapper div included). */
export declare function renderSoundsElement(sounds: SoundInput[], options?: WaveformSoundsOptions, className?: string): string;

export default WaveformSounds;

declare global {
    interface Window {
        WaveformSounds: typeof WaveformSounds;
    }
    interface HTMLElementEventMap extends WaveformSoundsEventMap {}
}
