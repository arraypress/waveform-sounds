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
 * The rectangles of a row waveform, in CSS pixels. Pure: the geometry is
 * separate from the canvas so it can be tested (and reused for both
 * passes of {@link drawRowWaveform}).
 *
 * Bars are normalised to the loudest one, so a quiet one-shot isn't a
 * flat line, and never shorter than 4% of the height.
 *
 * @param {number[]} peaks - 0..1.
 * @param {number} width - Canvas width (CSS px).
 * @param {number} height - Canvas height (CSS px).
 * @param {{style: 'mirror'|'bars', barWidth: number, barGap: number}} o
 * @returns {{x: number, y: number, w: number, h: number}[]}
 */
export function barRects(peaks, width, height, o) {
    const step = o.barWidth + o.barGap;
    const bars = resample(peaks, Math.max(1, Math.floor((width + o.barGap) / step)));
    const max = bars.reduce((m, b) => (b > m ? b : m), 0);
    const scale = max > 0 ? 1 / max : 1;
    return bars.map((b, i) => {
        const v = Math.max(b * scale, 0.04);
        if (o.style === 'bars') {
            const h = Math.max(1, v * height);
            return {x: i * step, y: height - h, w: o.barWidth, h};
        }
        const h = Math.max(1, v * (height - 2));
        return {x: i * step, y: height / 2 - h / 2, w: o.barWidth, h};
    });
}

/**
 * Draw a row waveform: every bar in the waveform colour, then the same
 * bars again in the progress colour, CLIPPED at the playhead. The played
 * part grows by the pixel — through the middle of a bar — rather than a
 * whole bar at a time, which on a short clip stepped visibly (an 8-second
 * loop across ~120 bars moved in ~15 jumps a second however fast it was
 * redrawn).
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

    const path = new Path2D();
    for (const r of barRects(peaks, width, height, o)) path.rect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = o.color;
    ctx.fill(path);
    const split = Math.min(Math.max(progress, 0), 1) * width;
    if (split > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, split, height);
        ctx.clip();
        ctx.fillStyle = o.progressColor;
        ctx.fill(path);
        ctx.restore();
    }
}
