/**
 * The row waveform: a small canvas of mirrored bars (or plain bars) drawn
 * from low-resolution peaks, with the played part in the progress colour.
 *
 * Deliberately NOT a WaveformPlayer per row. A pack can have 300 sounds;
 * 300 players would be 300 resize observers, theme watchers and option
 * pipelines for what is, until one is played, a static picture. One engine
 * player does the audio; these are pictures with a progress fill.
 *
 * @module draw
 */

/**
 * Size a canvas to its box at the device pixel ratio. Returns the CSS size,
 * or null when the canvas has no box (hidden row, jsdom).
 * @param {HTMLCanvasElement} canvas
 */
export function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return {width: rect.width, height: rect.height, dpr};
}

/**
 * Resample peaks to `count` bars (max of each bucket, so transients
 * survive the downsample).
 * @param {number[]} peaks
 * @param {number} count
 */
export function resample(peaks, count) {
    if (!peaks?.length || count <= 0) return [];
    if (peaks.length === count) return peaks;
    const out = new Array(count);
    const step = peaks.length / count;
    for (let i = 0; i < count; i++) {
        const start = Math.floor(i * step);
        const end = Math.max(start + 1, Math.floor((i + 1) * step));
        let m = 0;
        for (let j = start; j < end && j < peaks.length; j++) if (peaks[j] > m) m = peaks[j];
        out[i] = m;
    }
    return out;
}

/**
 * Draw a row waveform.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number[]|null} peaks - 0..1. Null draws a flat placeholder line.
 * @param {number} progress - 0..1 played.
 * @param {{style: 'mirror'|'bars', color: string, progressColor: string, barWidth: number, barGap: number}} o
 */
export function drawRowWaveform(canvas, peaks, progress, o) {
    const size = fitCanvas(canvas);
    const ctx = size && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const {width, height, dpr} = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!peaks?.length) {
        ctx.fillStyle = o.color;
        ctx.fillRect(0, Math.floor(height / 2), width, 1);
        return;
    }

    const step = o.barWidth + o.barGap;
    const count = Math.max(1, Math.floor((width + o.barGap) / step));
    const bars = resample(peaks, count);
    // Normalise to the loudest bar so quiet one-shots aren't a flat line.
    let max = 0;
    for (const b of bars) if (b > max) max = b;
    const scale = max > 0 ? 1 / max : 1;
    const split = progress * width;
    const mid = height / 2;

    for (let i = 0; i < bars.length; i++) {
        const x = i * step;
        const v = Math.max(bars[i] * scale, 0.04);
        ctx.fillStyle = x + o.barWidth / 2 <= split ? o.progressColor : o.color;
        if (o.style === 'bars') {
            const h = Math.max(1, v * height);
            ctx.fillRect(x, height - h, o.barWidth, h);
        } else {
            const h = Math.max(1, v * (height - 2));
            ctx.fillRect(x, mid - h / 2, o.barWidth, h);
        }
    }
}
