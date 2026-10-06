/**
 * @arraypress/waveform-sounds
 * A searchable, filterable list of sounds for WaveformPlayer.
 *
 * Importing this entry initialises every `[data-waveform-sounds]` element
 * once the DOM is ready. Opt out page-wide with
 * `<html data-waveform-autoinit="false">` (the family's switch), or import
 * `@arraypress/waveform-sounds/no-autoinit`.
 *
 * @author ArrayPress
 * @license MIT
 */
import WaveformSounds from './entry.js';

export * from './entry.js';
export default WaveformSounds;

if (typeof document !== 'undefined' && document.documentElement?.dataset?.waveformAutoinit !== 'false') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => WaveformSounds.init(), {once: true});
    } else {
        WaveformSounds.init();
    }
}
