/**
 * @arraypress/waveform-sounds — public surface, without the import-time
 * auto-init scan (`index.js` adds that). Anything new belongs here.
 *
 * @module entry
 */
import {WaveformSounds, DEFAULT_OPTIONS} from './core.js';
import {
    encodePeaks, decodePeaks, normalizeKey, normalizeSounds, parseManifest, facets, matches, sortSounds, formatDuration,
} from './data.js';
import {renderSounds, renderSoundsElement, DEFAULT_STRINGS} from './render.js';

WaveformSounds.utils = {encodePeaks, decodePeaks, normalizeKey, normalizeSounds, parseManifest, facets, matches, sortSounds, formatDuration, renderSounds};
WaveformSounds.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
WaveformSounds.DEFAULT_STRINGS = DEFAULT_STRINGS;

// CDN / <script> usage: a global, like the rest of the family.
if (typeof window !== 'undefined') window.WaveformSounds = WaveformSounds;

export default WaveformSounds;
export {
    WaveformSounds, DEFAULT_OPTIONS, DEFAULT_STRINGS,
    encodePeaks, decodePeaks, normalizeKey, normalizeSounds, parseManifest, facets, matches, sortSounds, formatDuration,
    renderSounds, renderSoundsElement,
};
