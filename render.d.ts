/** DOM-free server renderer: `@arraypress/waveform-sounds/render`. */
/** Escape a string for HTML text or a double-quoted attribute value. */
export declare function escapeHtml(value: unknown): string;
export {renderSounds, renderSoundsElement, DEFAULT_STRINGS, normalizeSounds, parseManifest, encodePeaks, decodePeaks, normalizeKey, facets, formatDuration} from './index.js';
export type {SoundInput, Sound, SoundsManifest, WaveformSoundsOptions, WaveformSoundsStrings} from './index.js';
