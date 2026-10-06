// src/js/data.js
function encodePeaks(peaks) {
  if (!Array.isArray(peaks)) return "";
  let out = "";
  for (const p of peaks) {
    const v = Math.round(Math.min(Math.max(Number(p) || 0, 0), 1) * 255);
    out += (v < 16 ? "0" : "") + v.toString(16);
  }
  return out;
}
function decodePeaks(value, scale = 1) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
    const out2 = new Array(value.length / 2);
    for (let i = 0; i < out2.length; i++) out2[i] = parseInt(value.substr(i * 2, 2), 16) / 255;
    return out2;
  }
  if (!Array.isArray(value)) return null;
  const s = Number(scale) > 0 ? Number(scale) : 1;
  const out = value.map((v) => Math.min(Math.max((Number(v) || 0) / s, 0), 1));
  return out.length ? out : null;
}
function normalizeKey(key) {
  if (key == null) return "";
  const raw = String(key).trim();
  const m = raw.match(/^([A-Ga-g])[\s_-]*([#♯b♭]?)[\s_-]*(m|min|minor|maj|major)?$/i);
  if (!m) return raw;
  const root = m[1].toUpperCase();
  const acc = m[2] === "\u266F" ? "#" : m[2] === "\u266D" ? "b" : m[2];
  const minor = m[3] && /^m(in(or)?)?$/i.test(m[3]) && m[3] !== "M";
  return root + acc + (minor ? "m" : "");
}
var KEY_PITCH = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
function keyRank(key) {
  if (!key) return Infinity;
  const minor = key.endsWith("m");
  const root = minor ? key.slice(0, -1) : key;
  const p = KEY_PITCH[root];
  return p === void 0 ? 1e3 : p * 2 + (minor ? 1 : 0);
}
function formatDuration(seconds) {
  if (seconds == null || seconds === "") return "";
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "";
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function parseDuration(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const str = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
  const parts = str.split(":").map(Number);
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
function titleFromUrl(url) {
  const file = String(url || "").split(/[?#]/)[0].split("/").pop() || "";
  let name = file.replace(/\.[a-z0-9]+$/i, "");
  try {
    name = decodeURIComponent(name);
  } catch {
  }
  return name.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeSound(input, index, peakScale = 1) {
  if (!input || typeof input !== "object" || !input.url) return null;
  const bpm = Number(input.bpm);
  const tags = Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim()).filter(Boolean) : typeof input.tags === "string" ? input.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  return {
    id: input.id != null && input.id !== "" ? String(input.id) : `sound-${index + 1}`,
    url: String(input.url),
    title: input.title ? String(input.title) : titleFromUrl(input.url),
    type: input.type ? String(input.type) : "",
    bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm * 100) / 100 : null,
    key: normalizeKey(input.key),
    duration: parseDuration(input.duration),
    tags,
    peaks: decodePeaks(input.peaks, peakScale),
    waveform: input.waveform ? String(input.waveform) : null
  };
}
function parseManifest(manifest) {
  const list = Array.isArray(manifest) ? manifest : Array.isArray(manifest?.sounds) ? manifest.sounds : [];
  const scale = Array.isArray(manifest) ? 1 : Number(manifest?.peakScale) || 1;
  return normalizeSounds(list, scale);
}
function normalizeSounds(list, peakScale = 1) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item, i) => {
    const s = normalizeSound(item, i, peakScale);
    if (!s) return;
    let id = s.id, n = 2;
    while (seen.has(id)) id = `${s.id}-${n++}`;
    s.id = id;
    seen.add(id);
    out.push(s);
  });
  return out;
}
function facets(sounds) {
  const types = /* @__PURE__ */ new Map();
  const keys = /* @__PURE__ */ new Set();
  let min = Infinity, max = -Infinity, hasDuration = false;
  for (const s of sounds) {
    if (s.type) types.set(s.type, (types.get(s.type) || 0) + 1);
    if (s.key) keys.add(s.key);
    if (s.bpm != null) {
      min = Math.min(min, s.bpm);
      max = Math.max(max, s.bpm);
    }
    if (s.duration != null) hasDuration = true;
  }
  return {
    types: [...types].map(([name, count]) => ({ name, count })),
    keys: [...keys].sort((a, b) => keyRank(a) - keyRank(b) || a.localeCompare(b)),
    bpm: min === Infinity ? null : { min, max },
    hasDuration
  };
}
function fold(str) {
  return String(str || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function matches(sound, filter = {}) {
  if (filter.type && sound.type !== filter.type) return false;
  if (filter.key && sound.key !== normalizeKey(filter.key)) return false;
  const lo = Number(filter.bpmMin), hi = Number(filter.bpmMax);
  if (filter.bpmMin != null && filter.bpmMin !== "" && Number.isFinite(lo) || filter.bpmMax != null && filter.bpmMax !== "" && Number.isFinite(hi)) {
    if (sound.bpm == null) return false;
    if (filter.bpmMin != null && filter.bpmMin !== "" && sound.bpm < lo) return false;
    if (filter.bpmMax != null && filter.bpmMax !== "" && sound.bpm > hi) return false;
  }
  const q = fold(filter.query).trim();
  if (q) {
    const hay = fold([sound.title, sound.type, sound.key, ...sound.tags || []].join(" "));
    for (const word of q.split(/\s+/)) {
      if (hay.includes(word)) continue;
      if (/^\d+$/.test(word) && sound.bpm != null && Math.round(sound.bpm) === Number(word)) continue;
      return false;
    }
  }
  return true;
}
var SORTS = ["default", "title", "bpm", "key", "duration"];
function sortSounds(sounds, by = "default") {
  const list = sounds.map((s, i) => ({ s, i }));
  const last = (v) => v == null ? Infinity : v;
  const cmp = {
    title: (a, b) => a.s.title.localeCompare(b.s.title, void 0, { numeric: true, sensitivity: "base" }),
    bpm: (a, b) => last(a.s.bpm) - last(b.s.bpm),
    key: (a, b) => keyRank(a.s.key) - keyRank(b.s.key),
    duration: (a, b) => last(a.s.duration) - last(b.s.duration)
  }[by];
  if (cmp) list.sort((a, b) => cmp(a, b) || a.i - b.i);
  return list.map((x) => x.s);
}

// src/js/render.js
var DEFAULT_STRINGS = {
  search: "Search sounds",
  searchPlaceholder: "Search sounds\u2026",
  all: "All",
  types: "Type",
  key: "Key",
  anyKey: "Any key",
  allTypes: "All types",
  findType: "Find a type\u2026",
  findKey: "Find a key\u2026",
  noMatches: "No matches",
  bpm: "BPM",
  bpmMin: "Min BPM",
  bpmMax: "Max BPM",
  sort: "Sort",
  sortBy: "Sort by",
  sortDefault: "Default",
  sortTitle: "Name",
  sortBpm: "BPM",
  sortKey: "Key",
  sortDuration: "Length",
  loop: "Loop",
  play: "Play {title}",
  pause: "Pause {title}",
  seek: "Seek {title}",
  count: "{count} sounds",
  countOne: "1 sound",
  countFiltered: "{count} of {total} sounds",
  showMore: "Show {count} more",
  empty: "No sounds match.",
  clear: "Clear filters",
  nowPlaying: "Playing {title}"
};
var RENDER_DEFAULTS = {
  player: "inline",
  search: true,
  filters: ["type", "key", "bpm"],
  sorts: ["default", "title", "bpm", "key", "duration"],
  loopToggle: true,
  showCount: true,
  menuSearch: 8,
  pageSize: 50,
  columns: ["type", "bpm", "key", "duration"],
  maxTypeChips: 10
};
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => k in vars ? String(vars[k]) : m);
}
function countText(shown, total, strings = DEFAULT_STRINGS) {
  if (shown !== total) return fill(strings.countFiltered, { count: shown, total });
  return total === 1 ? strings.countOne : fill(strings.count, { count: total });
}
var ICON_PLAY = '<svg class="ws-icon ws-icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>';
var ICON_PAUSE = '<svg class="ws-icon ws-icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
var ICON_SEARCH = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"/></svg>';
var ICON_CHEVRON = '<svg class="ws-icon ws-menu-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z"/></svg>';
var ICON_CHECK = '<svg class="ws-icon ws-menu-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>';
var ICON_LOOP = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 4l3 3-3 3V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V4zM7 20l-3-3 3-3v2h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v2z"/></svg>';
function resolveRenderOptions(options = {}) {
  const o = { ...RENDER_DEFAULTS, ...stripUndefined(options) };
  if (o.player !== "strip") o.player = "inline";
  o.filters = Array.isArray(o.filters) ? o.filters.filter((f) => ["type", "key", "bpm"].includes(f)) : RENDER_DEFAULTS.filters;
  o.sorts = Array.isArray(o.sorts) ? o.sorts.filter((k) => SORTS.includes(k)) : RENDER_DEFAULTS.sorts;
  o.menuSearch = Number.isFinite(Number(o.menuSearch)) && Number(o.menuSearch) >= 0 ? Math.floor(Number(o.menuSearch)) : RENDER_DEFAULTS.menuSearch;
  o.columns = Array.isArray(o.columns) ? o.columns.filter((c) => ["type", "bpm", "key", "duration"].includes(c)) : RENDER_DEFAULTS.columns;
  o.maxTypeChips = Number.isFinite(Number(o.maxTypeChips)) && Number(o.maxTypeChips) >= 0 ? Math.floor(Number(o.maxTypeChips)) : RENDER_DEFAULTS.maxTypeChips;
  o.pageSize = Number.isFinite(Number(o.pageSize)) && Number(o.pageSize) >= 0 ? Math.floor(Number(o.pageSize)) : RENDER_DEFAULTS.pageSize;
  o.strings = { ...DEFAULT_STRINGS, ...stripUndefined(options.strings || {}) };
  return o;
}
function stripUndefined(obj) {
  const out = {};
  for (const k in obj) if (obj[k] !== void 0) out[k] = obj[k];
  return out;
}
function renderRow(sound, index, o, hidden = false) {
  const s = o.strings;
  const attrs = [
    `class="ws-row"`,
    `data-ws-index="${index}"`,
    `data-ws-id="${escapeHtml(sound.id)}"`,
    `data-url="${escapeHtml(sound.url)}"`,
    `data-title="${escapeHtml(sound.title)}"`,
    sound.type ? `data-type="${escapeHtml(sound.type)}"` : "",
    sound.bpm != null ? `data-bpm="${sound.bpm}"` : "",
    sound.key ? `data-key="${escapeHtml(sound.key)}"` : "",
    sound.duration != null ? `data-duration="${sound.duration}"` : "",
    sound.tags?.length ? `data-tags="${escapeHtml(sound.tags.join(","))}"` : "",
    sound.peaks ? `data-peaks="${encodePeaks(sound.peaks)}"` : "",
    sound.waveform ? `data-waveform="${escapeHtml(sound.waveform)}"` : "",
    hidden ? "hidden" : ""
  ].filter(Boolean).join(" ");
  const cols = o.columns.map((c) => {
    if (c === "type") return `<span class="ws-cell ws-type">${escapeHtml(sound.type)}</span>`;
    if (c === "bpm") return `<span class="ws-cell ws-bpm">${sound.bpm != null ? escapeHtml(sound.bpm) : ""}</span>`;
    if (c === "key") return `<span class="ws-cell ws-key">${escapeHtml(sound.key)}</span>`;
    return `<span class="ws-cell ws-duration">${escapeHtml(formatDuration(sound.duration))}</span>`;
  }).join("");
  const wave = o.player === "inline" ? `<span class="ws-wave" role="slider" aria-label="${escapeHtml(fill(s.seek, { title: sound.title }))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="-1"><canvas class="ws-canvas" aria-hidden="true"></canvas></span>` : "";
  return `<li ${attrs}><button type="button" class="ws-play" aria-pressed="false" aria-label="${escapeHtml(fill(s.play, { title: sound.title }))}">${ICON_PLAY}${ICON_PAUSE}</button><span class="ws-cell ws-title">${escapeHtml(sound.title)}</span>` + cols + wave + `</li>`;
}
function availableSorts(sorts, f) {
  return sorts.filter((k) => k === "default" || k === "title" || k === "bpm" && f.bpm || k === "key" && f.keys.length || k === "duration" && f.hasDuration);
}
function idBase(list) {
  let h = 5381;
  const str = list.length + "|" + list.map((x) => x.url).join("|");
  for (let i = 0; i < str.length; i++) h = (h << 5) + h + str.charCodeAt(i) | 0;
  return "ws" + (h >>> 0).toString(36);
}
function renderMenu(name, m) {
  const id = `${m.id}-${name}`;
  const current = m.options.find((o) => o.value === m.value) || m.options[0];
  const searchable = m.options.length > m.searchFrom && m.placeholder;
  return `<div class="ws-menu" data-ws-menu="${name}"><button type="button" class="ws-menu-btn" data-ws-menu-btn aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list">` + (m.prefix ? `<span class="ws-menu-prefix">${escapeHtml(m.prefix)}</span>` : `<span class="ws-sr">${escapeHtml(m.label)}: </span>`) + `<span class="ws-menu-value" data-ws-menu-value>${escapeHtml(current.label)}</span>${ICON_CHEVRON}</button><div class="ws-menu-pop" data-ws-menu-pop hidden>` + (searchable ? `<input type="search" class="ws-menu-search" data-ws-menu-search role="combobox" aria-expanded="true" aria-controls="${id}-list" aria-autocomplete="list" aria-label="${escapeHtml(m.placeholder)}" placeholder="${escapeHtml(m.placeholder)}" autocomplete="off" spellcheck="false">` : "") + `<ul class="ws-menu-list" role="listbox" id="${id}-list" aria-label="${escapeHtml(m.label)}" tabindex="-1" data-ws-menu-list>` + m.options.map((o, i) => `<li role="option" id="${id}-${i}" class="ws-menu-option" data-value="${escapeHtml(o.value)}" aria-selected="${o === current}">${ICON_CHECK}<span class="ws-menu-text">${escapeHtml(o.label)}</span>` + (o.count != null ? `<span class="ws-menu-count">${o.count}</span>` : "") + "</li>").join("") + `</ul><p class="ws-menu-none" data-ws-menu-none hidden>${escapeHtml(m.noMatches)}</p></div></div>`;
}
function renderSounds(sounds, options = {}) {
  const o = resolveRenderOptions(options);
  const list = normalizeSounds(sounds);
  const s = o.strings;
  const f = facets(list);
  const total = list.length;
  const showTypes = o.filters.includes("type") && f.types.length > 1;
  const typeMenu = showTypes && f.types.length > o.maxTypeChips;
  const typeChips = showTypes && !typeMenu;
  const showKey = o.filters.includes("key") && f.keys.length > 1;
  const showBpm = o.filters.includes("bpm") && f.bpm && f.bpm.max > f.bpm.min;
  const sorts = availableSorts(o.sorts, f);
  const showSort = sorts.length > 1;
  const id = o.id || idBase(list);
  const menu = (name, m) => renderMenu(name, { searchFrom: o.menuSearch, noMatches: s.noMatches, id, ...m });
  const parts = [];
  parts.push('<div class="ws-toolbar">');
  if (o.search) {
    parts.push(`<label class="ws-search">${ICON_SEARCH}<span class="ws-sr">${escapeHtml(s.search)}</span><input type="search" class="ws-search-input" data-ws-search placeholder="${escapeHtml(s.searchPlaceholder)}" autocomplete="off" spellcheck="false"></label>`);
  }
  if (typeMenu || showKey || showBpm || showSort || o.loopToggle) {
    parts.push('<div class="ws-controls">');
    if (typeMenu) {
      parts.push(menu("type", {
        label: s.types,
        value: "",
        placeholder: s.findType,
        options: [{ value: "", label: s.allTypes, count: total }, ...f.types.map((t) => ({ value: t.name, label: t.name, count: t.count }))]
      }));
    }
    if (showKey) {
      parts.push(menu("key", {
        label: s.key,
        value: "",
        placeholder: s.findKey,
        options: [{ value: "", label: s.anyKey }, ...f.keys.map((k) => ({ value: k, label: k }))]
      }));
    }
    if (showBpm) {
      parts.push(`<span class="ws-bpm-range" role="group" aria-label="${escapeHtml(s.bpm)}"><input type="number" inputmode="numeric" data-ws-bpm-min aria-label="${escapeHtml(s.bpmMin)}" placeholder="${f.bpm.min}" min="0" step="1"><span aria-hidden="true">\u2013</span><input type="number" inputmode="numeric" data-ws-bpm-max aria-label="${escapeHtml(s.bpmMax)}" placeholder="${f.bpm.max}" min="0" step="1"><span class="ws-bpm-unit" aria-hidden="true">${escapeHtml(s.bpm)}</span></span>`);
    }
    if (showSort) {
      const label = { default: s.sortDefault, title: s.sortTitle, bpm: s.sortBpm, key: s.sortKey, duration: s.sortDuration };
      parts.push(menu("sort", {
        label: s.sort,
        prefix: s.sortBy,
        value: sorts[0],
        options: sorts.map((k) => ({ value: k, label: label[k] }))
      }));
    }
    if (o.loopToggle) {
      parts.push(`<button type="button" class="ws-loop" data-ws-loop aria-pressed="false">${ICON_LOOP}<span>${escapeHtml(s.loop)}</span></button>`);
    }
    parts.push("</div>");
  }
  if (typeChips || o.showCount) parts.push('<div class="ws-meta">');
  if (typeChips) {
    parts.push(`<div class="ws-types" role="group" aria-label="${escapeHtml(s.types)}"><button type="button" class="ws-chip" data-ws-type="" aria-pressed="true"><span class="ws-chip-label">${escapeHtml(s.all)}</span> <span class="ws-chip-count">${total}</span></button>` + f.types.map((t) => `<button type="button" class="ws-chip" data-ws-type="${escapeHtml(t.name)}" aria-pressed="false"><span class="ws-chip-label">${escapeHtml(t.name)}</span> <span class="ws-chip-count">${t.count}</span></button>`).join("") + "</div>");
  }
  if (o.showCount) parts.push(`<p class="ws-count" data-ws-count aria-live="polite">${escapeHtml(countText(total, total, s))}</p>`);
  if (typeChips || o.showCount) parts.push("</div>");
  parts.push("</div>");
  const page = o.pageSize > 0 ? o.pageSize : Infinity;
  parts.push(`<ul class="ws-list ws-list--${o.player}" role="list" data-ws-list>` + list.map((sound, i) => renderRow(sound, i, o, i >= page)).join("") + "</ul>");
  const more = total - Math.min(total, page);
  parts.push(`<p class="ws-empty" data-ws-empty hidden>${escapeHtml(s.empty)} <button type="button" class="ws-clear" data-ws-clear>${escapeHtml(s.clear)}</button></p>`);
  parts.push(`<button type="button" class="ws-more" data-ws-more${more > 0 ? "" : " hidden"}>${escapeHtml(fill(s.showMore, { count: Math.min(more, o.pageSize || more) }))}</button>`);
  parts.push(`<div class="ws-engine${o.player === "strip" ? " ws-engine--strip" : ""}" data-ws-engine${o.player === "strip" ? "" : " hidden"}></div>`);
  parts.push('<p class="ws-sr" data-ws-status aria-live="polite"></p>');
  return parts.join("");
}
function renderSoundsElement(sounds, options = {}, className = "") {
  const o = resolveRenderOptions(options);
  const cls = ["waveform-sounds", `waveform-sounds--${o.player}`, className].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(cls)}" data-waveform-sounds data-player="${o.player}">${renderSounds(sounds, options)}</div>`;
}

// src/js/draw.js
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { width: rect.width, height: rect.height, dpr };
}
function resample(peaks, count) {
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
function drawRowWaveform(canvas, peaks, progress, o) {
  const size = fitCanvas(canvas);
  const ctx = size && canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;
  const { width, height, dpr } = size;
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
  let max = 0;
  for (const b of bars) if (b > max) max = b;
  const scale = max > 0 ? 1 / max : 1;
  const split = progress * width;
  const mid = height / 2;
  for (let i = 0; i < bars.length; i++) {
    const x = i * step;
    const v = Math.max(bars[i] * scale, 0.04);
    ctx.fillStyle = x + o.barWidth / 2 <= split ? o.progressColor : o.color;
    if (o.style === "bars") {
      const h = Math.max(1, v * height);
      ctx.fillRect(x, height - h, o.barWidth, h);
    } else {
      const h = Math.max(1, v * (height - 2));
      ctx.fillRect(x, mid - h / 2, o.barWidth, h);
    }
  }
}

// src/js/core.js
var LOG = "[WaveformSounds]";
var DEFAULT_OPTIONS = {
  ...RENDER_DEFAULTS,
  sounds: null,
  manifest: null,
  waveformStyle: "mirror",
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
  onError: null
};
function readDataOptions(el) {
  const d = el.dataset || {};
  const out = {};
  const bool = (v) => v === "" || v === "true" ? true : v === "false" ? false : void 0;
  const list = (v) => v == null ? void 0 : v.split(",").map((x) => x.trim()).filter(Boolean);
  if (d.player) out.player = d.player;
  if (d.manifest) out.manifest = d.manifest;
  if (d.search !== void 0) out.search = bool(d.search);
  if (d.filters !== void 0) out.filters = list(d.filters);
  if (d.sorts !== void 0) out.sorts = list(d.sorts);
  if (d.showCount !== void 0) out.showCount = bool(d.showCount);
  if (d.menuSearch !== void 0 && d.menuSearch !== "") out.menuSearch = Number(d.menuSearch);
  if (d.loopToggle !== void 0) out.loopToggle = bool(d.loopToggle);
  if (d.pageSize !== void 0 && d.pageSize !== "") out.pageSize = Number(d.pageSize);
  if (d.maxTypeChips !== void 0 && d.maxTypeChips !== "") out.maxTypeChips = Number(d.maxTypeChips);
  if (d.columns !== void 0) out.columns = list(d.columns);
  if (d.waveformStyle) out.waveformStyle = d.waveformStyle;
  if (d.waveformColor) out.waveformColor = d.waveformColor;
  if (d.progressColor) out.progressColor = d.progressColor;
  if (d.barWidth !== void 0 && d.barWidth !== "") out.barWidth = Number(d.barWidth);
  if (d.barGap !== void 0 && d.barGap !== "") out.barGap = Number(d.barGap);
  if (d.loop !== void 0) out.loop = bool(d.loop);
  if (d.autoAdvance !== void 0) out.autoAdvance = bool(d.autoAdvance);
  if (d.arrowAudition !== void 0) out.arrowAudition = bool(d.arrowAudition);
  const json = (v, name) => {
    try {
      return JSON.parse(v);
    } catch {
      console.warn(`${LOG} Ignoring invalid JSON in data-${name}`);
      return void 0;
    }
  };
  if (d.strings) out.strings = json(d.strings, "strings");
  if (d.playerOptions) out.playerOptions = json(d.playerOptions, "player-options");
  for (const k of Object.keys(out)) if (out[k] === void 0) delete out[k];
  return out;
}
function merge(...sources) {
  const out = {};
  for (const src of sources) {
    if (!src) continue;
    for (const k in src) if (src[k] !== null && src[k] !== void 0) out[k] = src[k];
  }
  return out;
}
var isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
var WaveformSounds = class _WaveformSounds {
  /** @type {Map<Element, WaveformSounds>} */
  static instances = /* @__PURE__ */ new Map();
  /**
   * @param {HTMLElement|string} container - The element (or a selector).
   * @param {import('../../index').WaveformSoundsOptions} [options]
   */
  constructor(container, options = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) throw new Error(`${LOG} Container not found: ${container}`);
    this.container = el;
    this.options = merge(DEFAULT_OPTIONS, options, readDataOptions(el));
    this.options.waveformStyle = this.options.waveformStyle === "bars" ? "bars" : "mirror";
    this.render = resolveRenderOptions(this.options);
    this.strings = { ...DEFAULT_STRINGS, ...this.options.strings || {} };
    this.render.strings = this.strings;
    this.sounds = [];
    this.rows = [];
    this.filter = { query: "", type: "", key: "", bpmMin: "", bpmMax: "" };
    this.sortBy = "default";
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
    _WaveformSounds.instances.set(el, this);
    el.dataset.wsInitialized = "true";
    this.ready = Promise.resolve().then(() => this._init()).catch((err) => {
      console.error(`${LOG} Failed to initialise:`, err);
      this._emit("error", { error: err });
      if (typeof this.options.onError === "function") this.options.onError(err, this);
    });
  }
  /* ── Setup ─────────────────────────────────────────────────────────── */
  async _init() {
    const el = this.container;
    const adopted = el.querySelector("[data-ws-list]");
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
      el.innerHTML = renderSounds(list, { ...this.render, strings: this.strings });
    }
    if (this.destroyed) return;
    this._addedClasses = ["waveform-sounds", `waveform-sounds--${this.render.player}`].filter((c) => !el.classList.contains(c));
    el.classList.add(...this._addedClasses);
    this._cacheRefs();
    this._bind();
    this._observe();
    this._resolveColors();
    this._setLoop(this.loop);
    if (!this._sortSet) this.sortBy = availableSorts(this.render.sorts, facets(this.sounds))[0] || "default";
    this._syncControls();
    this._apply({ resort: this.sortBy !== "default" });
    this._emit("ready", { sounds: this.sounds.length });
    if (typeof this.options.onReady === "function") this.options.onReady(this);
  }
  /**
   * Server-rendered rows → sounds. Rows are taken in their original
   * order (data-ws-index) and renumbered 0..n-1, so a row dropped from
   * the markup (or one without a url) can't leave a hole that would
   * misalign rows and sounds.
   */
  _readRows(list) {
    const rows = [...list.querySelectorAll(":scope > [data-ws-index]")].sort((a, b) => Number(a.dataset.wsIndex) - Number(b.dataset.wsIndex));
    const out = [];
    for (const row of rows) {
      const d = row.dataset;
      const s = normalizeSound({
        id: d.wsId,
        url: d.url,
        title: d.title,
        type: d.type,
        bpm: d.bpm,
        key: d.key,
        duration: d.duration,
        tags: d.tags,
        peaks: d.peaks,
        waveform: d.waveform
      }, out.length);
      if (!s) {
        row.remove();
        continue;
      }
      row.dataset.wsIndex = String(out.length);
      out.push(s);
    }
    return out;
  }
  _cacheRefs() {
    const q = (sel) => this.container.querySelector(sel);
    this.$ = {
      list: q("[data-ws-list]"),
      search: q("[data-ws-search]"),
      menus: Object.fromEntries([...this.container.querySelectorAll("[data-ws-menu]")].map((m) => [m.dataset.wsMenu, m])),
      bpmMin: q("[data-ws-bpm-min]"),
      bpmMax: q("[data-ws-bpm-max]"),
      loop: q("[data-ws-loop]"),
      count: q("[data-ws-count]"),
      empty: q("[data-ws-empty]"),
      more: q("[data-ws-more]"),
      engine: q("[data-ws-engine]"),
      status: q("[data-ws-status]"),
      chips: [...this.container.querySelectorAll("[data-ws-type]")]
    };
    this.rows = [];
    this.$.list.querySelectorAll(":scope > [data-ws-index]").forEach((row) => {
      this.rows[Number(row.dataset.wsIndex)] = row;
    });
  }
  _bind() {
    const sig = { signal: this._ctl.signal };
    const $ = this.$;
    const root = this.container;
    root.addEventListener("click", (e) => {
      const t = e.target;
      const chip = t.closest("[data-ws-type]");
      if (chip) return this.setFilter({ type: chip.dataset.wsType });
      if (t.closest("[data-ws-more]")) return this.showMore();
      if (t.closest("[data-ws-clear]")) return this.clearFilters();
      if (t.closest("[data-ws-loop]")) return this.setLoop(!this.loop);
      const row = t.closest("[data-ws-index]");
      if (!row || t.closest(".ws-wave")) return;
      this.toggle(Number(row.dataset.wsIndex));
    }, sig);
    root.addEventListener("pointerdown", (e) => {
      const wave = e.target.closest(".ws-wave");
      if (!wave || e.button !== 0) return;
      const row = wave.closest("[data-ws-index]");
      const r = wave.getBoundingClientRect();
      const pct = r.width ? Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) : 0;
      e.preventDefault();
      this._seekRow(Number(row.dataset.wsIndex), pct);
    }, sig);
    let tSearch = 0, tBpm = 0;
    $.search?.addEventListener("input", () => {
      clearTimeout(tSearch);
      tSearch = setTimeout(() => this.setFilter({ query: $.search.value }), 120);
    }, sig);
    $.search?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._focusRow(this._visibleRows()[0]);
      }
      if (e.key === "Escape" && $.search.value) {
        e.preventDefault();
        $.search.value = "";
        this.setFilter({ query: "" });
      }
    }, sig);
    this._bindMenus(sig);
    const bpm = () => {
      clearTimeout(tBpm);
      tBpm = setTimeout(() => this.setFilter({ bpmMin: $.bpmMin?.value ?? "", bpmMax: $.bpmMax?.value ?? "" }), 200);
    };
    $.bpmMin?.addEventListener("input", bpm, sig);
    $.bpmMax?.addEventListener("input", bpm, sig);
    root.addEventListener("keydown", (e) => this._onKey(e), sig);
    document.addEventListener("waveformplayer:play", (e) => {
      const p = e.detail?.player;
      if (p && p !== this.engine && this.playing) this.pause();
    }, sig);
  }
  /* ── Dropdowns (type / key / sort) ───────────────────────────────── */
  /**
   * A dropdown is a button and a popup listbox (+ a search field when it
   * has many options). The popup follows the WAI-ARIA combobox/listbox
   * pattern: focus stays in the search field (or the list), the active
   * option is `aria-activedescendant`, ↑/↓ move, Enter picks, Esc closes.
   */
  _bindMenus(sig) {
    for (const [name, menu] of Object.entries(this.$.menus)) {
      const btn = menu.querySelector("[data-ws-menu-btn]");
      const search = menu.querySelector("[data-ws-menu-search]");
      const list = menu.querySelector("[data-ws-menu-list]");
      btn.addEventListener("click", () => this._openMenu === menu ? this._closeMenu(true) : this._open(menu), sig);
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          this._open(menu);
        }
      }, sig);
      list.addEventListener("click", (e) => {
        const opt = e.target.closest('[role="option"]');
        if (opt) this._pick(name, opt.dataset.value);
      }, sig);
      list.addEventListener("mousedown", (e) => e.preventDefault(), sig);
      search?.addEventListener("input", () => this._filterMenu(menu, search.value), sig);
      (search || list).addEventListener("keydown", (e) => this._menuKey(e, name, menu), sig);
    }
    document.addEventListener("pointerdown", (e) => {
      if (this._openMenu && !this._openMenu.contains(e.target)) this._closeMenu(false);
    }, sig);
    this.container.addEventListener("focusout", (e) => {
      if (this._openMenu && !this._openMenu.contains(e.relatedTarget)) this._closeMenu(false);
    }, sig);
  }
  _open(menu) {
    if (this._openMenu && this._openMenu !== menu) this._closeMenu(false);
    const pop = menu.querySelector("[data-ws-menu-pop]");
    const search = menu.querySelector("[data-ws-menu-search]");
    menu.querySelector("[data-ws-menu-btn]").setAttribute("aria-expanded", "true");
    pop.hidden = false;
    this._openMenu = menu;
    if (search) {
      search.value = "";
      this._filterMenu(menu, "");
    }
    menu.classList.remove("ws-menu--end");
    const box = this.container.getBoundingClientRect(), r = pop.getBoundingClientRect();
    if (r.right > box.right + 1) menu.classList.add("ws-menu--end");
    this._activate(menu, menu.querySelector('[role="option"][aria-selected="true"]'));
    (search || menu.querySelector("[data-ws-menu-list]")).focus();
  }
  _closeMenu(focusButton) {
    const menu = this._openMenu;
    if (!menu) return;
    this._openMenu = null;
    menu.querySelector("[data-ws-menu-pop]").hidden = true;
    const btn = menu.querySelector("[data-ws-menu-btn]");
    btn.setAttribute("aria-expanded", "false");
    if (focusButton) btn.focus();
  }
  /** Narrow a menu to the options whose label contains `query`. */
  _filterMenu(menu, query) {
    const q = String(query).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    let first = null, any = false;
    menu.querySelectorAll('[role="option"]').forEach((opt) => {
      const text = opt.textContent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const show = !q || text.includes(q);
      opt.hidden = !show;
      if (show) {
        any = true;
        first ??= opt;
      }
    });
    menu.querySelector("[data-ws-menu-none]").hidden = any;
    this._activate(menu, first);
  }
  _activate(menu, opt) {
    menu.querySelectorAll(".ws-menu-option.is-active").forEach((o) => o.classList.remove("is-active"));
    const owner = menu.querySelector("[data-ws-menu-search]") || menu.querySelector("[data-ws-menu-list]");
    if (!opt || opt.hidden) {
      owner.removeAttribute("aria-activedescendant");
      return;
    }
    opt.classList.add("is-active");
    owner.setAttribute("aria-activedescendant", opt.id);
    opt.scrollIntoView?.({ block: "nearest" });
  }
  _menuKey(e, name, menu) {
    const opts = [...menu.querySelectorAll('[role="option"]')].filter((o) => !o.hidden);
    const cur = opts.indexOf(menu.querySelector(".ws-menu-option.is-active"));
    const go = (i) => {
      e.preventDefault();
      this._activate(menu, opts[Math.max(0, Math.min(opts.length - 1, i))]);
    };
    switch (e.key) {
      case "ArrowDown":
        return go(cur + 1);
      case "ArrowUp":
        return go(cur - 1);
      case "Home":
        return e.target.matches("input") ? void 0 : go(0);
      case "End":
        return e.target.matches("input") ? void 0 : go(opts.length - 1);
      case "Enter": {
        e.preventDefault();
        if (cur >= 0) this._pick(name, opts[cur].dataset.value);
        return;
      }
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return this._closeMenu(true);
      case "Tab":
        return this._closeMenu(false);
      default:
    }
  }
  _pick(name, value) {
    this._closeMenu(true);
    if (name === "sort") this.setSort(value);
    else this.setFilter({ [name]: value });
  }
  /** Show `value` as a menu's current choice. */
  _menuValue(name, value) {
    const menu = this.$?.menus?.[name];
    if (!menu) return;
    let label = null;
    menu.querySelectorAll('[role="option"]').forEach((o) => {
      const on = o.dataset.value === String(value ?? "");
      o.setAttribute("aria-selected", String(on));
      if (on) label = o.querySelector(".ws-menu-text")?.textContent ?? "";
    });
    if (label != null) menu.querySelector("[data-ws-menu-value]").textContent = label;
  }
  _onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "/" && !isTyping(e.target) && this.$.search) {
      e.preventDefault();
      this.$.search.focus();
      return;
    }
    const row = e.target.closest?.("[data-ws-index]");
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
      case "ArrowDown":
        return go(visible[at + 1]);
      case "ArrowUp":
        return at > 0 ? go(visible[at - 1]) : (e.preventDefault(), this.$.search?.focus());
      case "Home":
        return go(visible[0]);
      case "End":
        return go(visible[visible.length - 1]);
      case "ArrowRight":
      case "ArrowLeft": {
        if (index !== this.currentIndex || !this.engine) return;
        e.preventDefault();
        const step = e.key === "ArrowRight" ? 0.1 : -0.1;
        this._seekRow(index, Math.min(Math.max(this.progress + step, 0), 0.999));
        return;
      }
      default:
    }
  }
  /** Draw row canvases when they scroll into view; redraw on resize/theme. */
  _observe() {
    if (this.render.player !== "inline" || typeof window === "undefined") return;
    this._drawn = /* @__PURE__ */ new Set();
    if ("IntersectionObserver" in window) {
      this._io = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const i = Number(en.target.dataset.wsIndex);
          this._drawn.add(i);
          this._drawRow(i);
        }
      }, { rootMargin: "200px 0px" });
      this.rows.forEach((r) => r && this._io.observe(r));
    } else {
      this.rows.forEach((r, i) => r && this._drawn.add(i));
    }
    if ("ResizeObserver" in window) {
      let w = 0;
      this._ro = new ResizeObserver(([en]) => {
        const nw = Math.round(en.contentRect.width);
        if (nw === w) return;
        w = nw;
        this._redrawAll();
      });
      this._ro.observe(this.$.list);
    }
    const refresh = () => requestAnimationFrame(() => {
      this._resolveColors();
      this._redrawAll();
    });
    this._mo = new MutationObserver(refresh);
    const attrs = { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme", "style"] };
    this._mo.observe(document.documentElement, attrs);
    if (document.body) this._mo.observe(document.body, attrs);
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", refresh, { signal: this._ctl.signal });
    } catch {
    }
  }
  /** Canvas colours: the options, else the CSS custom properties. */
  _resolveColors() {
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
    this.container.appendChild(probe);
    const read = (v) => {
      probe.style.color = "";
      probe.style.color = v;
      return getComputedStyle(probe).color;
    };
    if (this._autoSurface || !getComputedStyle(this.container).getPropertyValue("--ws-surface").trim()) {
      this._autoSurface = true;
      this.container.style.removeProperty("--ws-surface");
      this.container.style.setProperty("--ws-surface", this._surface());
    }
    this.colors = {
      wave: this.options.waveformColor || read("var(--ws-wave-color)") || "rgba(128,128,128,.5)",
      progress: this.options.progressColor || read("var(--ws-progress-color)") || "currentColor"
    };
    probe.remove();
  }
  /** The first opaque background behind the list (white if none). */
  _surface() {
    for (let el = this.container; el && el.nodeType === 1; el = el.parentElement || el.getRootNode?.().host) {
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        if (parts.length < 4 || parts[3] > 0.95) return bg;
      }
    }
    return "#fff";
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
    this.filter = { ...this.filter, ...patch };
    this.limit = this.render.pageSize > 0 ? this.render.pageSize : Infinity;
    this._syncControls();
    this._apply({ resort: false });
  }
  /** Reset every filter (the sort stays). */
  clearFilters() {
    this.setFilter({ query: "", type: "", key: "", bpmMin: "", bpmMax: "" });
  }
  /** @param {'default'|'title'|'bpm'|'key'|'duration'} by */
  setSort(by) {
    this._sortSet = true;
    this.sortBy = SORTS.includes(by) ? by : "default";
    this._menuValue("sort", this.sortBy);
    this._apply({ resort: true });
  }
  /** Reveal the next page of results. */
  showMore() {
    if (this.limit === Infinity) return;
    this.limit += this.render.pageSize;
    this._apply({ resort: false });
  }
  /** Keep the controls in step when the filter is set from code. */
  _syncControls() {
    const $ = this.$, f = this.filter;
    if (!$) return;
    if ($.search && $.search.value !== f.query) $.search.value = f.query;
    this._menuValue("type", f.type || "");
    this._menuValue("key", f.key || "");
    this._menuValue("sort", this.sortBy);
    if ($.bpmMin && $.bpmMin.value !== String(f.bpmMin)) $.bpmMin.value = f.bpmMin;
    if ($.bpmMax && $.bpmMax.value !== String(f.bpmMax)) $.bpmMax.value = f.bpmMax;
    $.chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.wsType === (f.type || ""))));
  }
  _apply({ resort }) {
    const $ = this.$;
    if (!$) return;
    const shown = this.visible;
    if (resort || this.sortBy !== this._lastSort) {
      const order = sortSounds(this.sounds, this.sortBy);
      const frag = document.createDocumentFragment();
      for (const s of order) {
        const row = this.rows[this.sounds.indexOf(s)];
        if (row) frag.appendChild(row);
      }
      $.list.appendChild(frag);
      this._lastSort = this.sortBy;
    }
    const visibleSet = /* @__PURE__ */ new Set();
    shown.forEach((s, i) => {
      if (i < this.limit) visibleSet.add(s);
    });
    this.sounds.forEach((s, i) => {
      const row = this.rows[i];
      if (row) row.hidden = !visibleSet.has(s);
    });
    const remaining = shown.length - visibleSet.size;
    if ($.more) {
      $.more.hidden = remaining <= 0;
      $.more.textContent = fill(this.strings.showMore, { count: Math.min(remaining, this.render.pageSize || remaining) });
    }
    if ($.empty) $.empty.hidden = shown.length > 0;
    if ($.count) $.count.textContent = countText(shown.length, this.sounds.length, this.strings);
    this._emit("filter", { visible: shown.length, total: this.sounds.length, filter: { ...this.filter }, sort: this.sortBy });
    if (typeof this.options.onFilter === "function") this.options.onFilter(shown, this);
  }
  _visibleRows() {
    return [...this.$.list.children].filter((r) => r.matches("[data-ws-index]") && !r.hidden);
  }
  _focusRow(row) {
    row?.querySelector(".ws-play")?.focus();
  }
  /* ── Playback ─────────────────────────────────────────────────────── */
  /** Resolve an index, id or sound to an index in `this.sounds`. */
  _indexOf(target) {
    if (target == null) return this.currentIndex ?? (this.visible[0] ? this.sounds.indexOf(this.visible[0]) : null);
    if (typeof target === "number") return this.sounds[target] ? target : null;
    if (typeof target === "object") {
      const i2 = this.sounds.indexOf(target);
      return i2 >= 0 ? i2 : null;
    }
    const i = this.sounds.findIndex((s) => s.id === String(target));
    return i >= 0 ? i : null;
  }
  _ensureEngine() {
    if (this.engine) return this.engine;
    const Player = this.options.playerClass || (typeof window !== "undefined" ? window.WaveformPlayer : null);
    if (!Player) {
      console.error(`${LOG} @arraypress/waveform-player is required: load it before playing (or pass playerClass).`);
      return null;
    }
    const user = this.options.playerOptions || {};
    const strip = this.render.player === "strip";
    const call = (name, ...args) => {
      if (typeof user[name] === "function") user[name](...args);
    };
    this.engine = new Player(this.$.engine, {
      height: strip ? 48 : 32,
      waveformStyle: strip ? "mirror" : "bars",
      preload: "metadata",
      singlePlay: true,
      ...user,
      audioMode: "self",
      onLoad: (p) => {
        this._onEngineLoad();
        call("onLoad", p);
      },
      onPlay: (p) => {
        this._setPlaying(true);
        call("onPlay", p);
      },
      onPause: (p) => {
        this._setPlaying(false);
        call("onPause", p);
      },
      onEnd: (p) => {
        this._onEnd();
        call("onEnd", p);
      },
      onTimeUpdate: (t, d, p) => {
        this._onTime(t, d);
        call("onTimeUpdate", t, d, p);
      },
      onError: (err, p) => {
        this._onEngineError(err);
        call("onError", err, p);
      }
    });
    return this.engine;
  }
  /**
   * Play a sound (by index, id or sound object), or resume the current one.
   * @param {number|string|Object} [target]
   * @param {{at?: number}} [opts] - `at`: start position 0..1.
   */
  play(target, opts = {}) {
    if (!this.$) {
      this.ready.then(() => {
        if (!this.destroyed) this.play(target, opts);
      });
      return;
    }
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
    const strip = this.render.player === "strip";
    const waveform = strip && sound.waveform || sound.peaks || null;
    engine.loadTrack(sound.url, sound.title, sound.type || null, { waveform, autoplay: true });
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
  next() {
    this._step(1);
  }
  /** Play the previous visible sound. */
  previous() {
    this._step(-1);
  }
  _step(dir) {
    const shown = this.visible;
    const cur = this.currentIndex == null ? -1 : shown.indexOf(this.sounds[this.currentIndex]);
    const nextSound = shown[cur + dir];
    if (!nextSound) return false;
    const i = this.sounds.indexOf(nextSound);
    const pos = shown.indexOf(nextSound);
    if (pos >= this.limit) {
      this.limit = pos + 1;
      this._apply({ resort: false });
    }
    this.play(i);
    return true;
  }
  /** Loop the current sound (auditioning a loop is the common case). */
  setLoop(on) {
    this.loop = !!on;
    this._setLoop(this.loop);
  }
  _setLoop(on) {
    if (this.$?.loop) this.$.loop.setAttribute("aria-pressed", String(on));
    if (this.engine?.audio) this.engine.audio.loop = on;
  }
  _seekRow(index, pct) {
    if (index !== this.currentIndex || !this.engine) return this.play(index, { at: pct });
    const d = this.engine.audio?.duration;
    if (!Number.isFinite(d) || d <= 0) {
      this._pendingSeek = pct;
      return;
    }
    this.engine.seekTo(pct * d);
    this.progress = pct;
    this._paintRow(index);
    if (!this.playing) this.engine.play();
  }
  _onEngineLoad() {
    if (this.engine?.audio) this.engine.audio.loop = this.loop;
    const sound = this.sounds[this.currentIndex];
    if (sound && !sound.peaks && Array.isArray(this.engine?.waveformData) && this.engine.waveformData.length) {
      sound.peaks = resample(this.engine.waveformData, 96);
      this._drawRow(this.currentIndex);
    }
    if (this._pendingSeek != null) {
      const pct = this._pendingSeek;
      const d = this.engine.audio?.duration;
      if (Number.isFinite(d) && d > 0) {
        this._pendingSeek = null;
        this.engine.seekTo(pct * d);
        this.progress = pct;
      }
    }
  }
  _onTime(t, d) {
    if (this.currentIndex == null || !d) return;
    if (this._pendingSeek != null) {
      const p = this._pendingSeek;
      this._pendingSeek = null;
      this.engine.seekTo(p * d);
      return;
    }
    this.progress = Math.min(Math.max(t / d, 0), 1);
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._drawRow(this.currentIndex);
      const wave = this.rows[this.currentIndex]?.querySelector(".ws-wave");
      if (wave) wave.setAttribute("aria-valuenow", String(Math.round(this.progress * 100)));
    });
  }
  _onEnd() {
    const sound = this.sounds[this.currentIndex];
    this._emit("end", { sound, index: this.currentIndex });
    if (typeof this.options.onEnd === "function") this.options.onEnd(sound, this);
    if (this.options.autoAdvance && this._step(1)) return;
    this.progress = 0;
    this._setPlaying(false);
  }
  _onEngineError(err) {
    const row = this.rows[this.currentIndex];
    if (row) row.classList.add("is-error");
    const sound = this.sounds[this.currentIndex];
    this._emit("error", { error: err, sound, index: this.currentIndex });
    if (typeof this.options.onError === "function") this.options.onError(err, this);
  }
  _setPlaying(on) {
    const changed = this.playing !== on;
    this.playing = on;
    const index = this.currentIndex;
    if (index == null) return;
    this._paintRow(index);
    if (!changed) return;
    const sound = this.sounds[index];
    if (on) {
      if (this.$.status) this.$.status.textContent = fill(this.strings.nowPlaying, { title: sound.title });
      this._emit("play", { sound, index });
      if (typeof this.options.onPlay === "function") this.options.onPlay(sound, this);
    } else {
      this._emit("pause", { sound, index });
      if (typeof this.options.onPause === "function") this.options.onPause(sound, this);
    }
  }
  /* ── Row painting ─────────────────────────────────────────────────── */
  /** State classes, button label and the waveform of one row. */
  _paintRow(index) {
    const row = this.rows[index];
    if (!row) return;
    const current = index === this.currentIndex;
    const on = current && this.playing;
    row.classList.toggle("is-current", current);
    row.classList.toggle("is-playing", on);
    const btn = row.querySelector(".ws-play");
    const title = this.sounds[index].title;
    if (btn) {
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", fill(on ? this.strings.pause : this.strings.play, { title }));
    }
    const wave = row.querySelector(".ws-wave");
    if (wave) {
      wave.tabIndex = current ? 0 : -1;
      if (!current) wave.setAttribute("aria-valuenow", "0");
    }
    this._drawRow(index);
  }
  _drawRow(index) {
    if (this.render.player !== "inline" || index == null || !this._drawn?.has(index)) return;
    const row = this.rows[index];
    const canvas = row?.querySelector("canvas");
    if (!canvas || row.hidden) return;
    drawRowWaveform(canvas, this.sounds[index].peaks, index === this.currentIndex ? this.progress : 0, {
      style: this.options.waveformStyle,
      color: this.colors?.wave || "rgba(128,128,128,.5)",
      progressColor: this.colors?.progress || "currentColor",
      barWidth: Math.max(1, Number(this.options.barWidth) || 2),
      barGap: Number.isFinite(Number(this.options.barGap)) ? Math.max(0, Number(this.options.barGap)) : 1
    });
  }
  _redrawAll() {
    this._drawn?.forEach((i) => this._drawRow(i));
  }
  /* ── Events & lifecycle ──────────────────────────────────────────── */
  _emit(name, detail = {}) {
    this.container.dispatchEvent(new CustomEvent(`waveformsounds:${name}`, {
      bubbles: true,
      detail: { ...detail, instance: this }
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
    try {
      this.engine?.destroy();
    } catch {
    }
    this.engine = null;
    if (this._originalHTML != null) this.container.innerHTML = this._originalHTML;
    if (this._addedClasses?.length) this.container.classList.remove(...this._addedClasses);
    if (this._autoSurface) this.container.style.removeProperty("--ws-surface");
    delete this.container.dataset.wsInitialized;
    _WaveformSounds.instances.delete(this.container);
  }
  /**
   * Initialise every `[data-waveform-sounds]` under `root` that isn't yet.
   * @param {ParentNode} [root=document]
   * @returns {WaveformSounds[]} The new instances.
   */
  static init(root = document) {
    if (typeof document === "undefined") return [];
    const out = [];
    const scope = root || document;
    const els = [...scope.matches?.("[data-waveform-sounds]") ? [scope] : [], ...scope.querySelectorAll("[data-waveform-sounds]")];
    for (const el of els) {
      if (el.dataset.wsInitialized === "true" || _WaveformSounds.instances.has(el)) continue;
      try {
        out.push(new _WaveformSounds(el));
      } catch (err) {
        console.error(`${LOG} Failed to initialise:`, err, el);
      }
    }
    return out;
  }
  /** The instance on an element (or selector), if any. */
  static getInstance(el) {
    const node = typeof el === "string" ? document.querySelector(el) : el;
    return node ? _WaveformSounds.instances.get(node) || null : null;
  }
  /** Destroy instances whose element has left the document (after a
   *  client-side navigation). */
  static prune() {
    for (const [el, inst] of _WaveformSounds.instances) if (!el.isConnected) inst.destroy();
  }
};

// src/js/entry.js
WaveformSounds.utils = { encodePeaks, decodePeaks, normalizeKey, normalizeSounds, parseManifest, facets, matches, sortSounds, formatDuration, renderSounds };
WaveformSounds.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
WaveformSounds.DEFAULT_STRINGS = DEFAULT_STRINGS;
if (typeof window !== "undefined") window.WaveformSounds = WaveformSounds;
var entry_default = WaveformSounds;

// src/js/index.js
var index_default = entry_default;
if (typeof document !== "undefined" && document.documentElement?.dataset?.waveformAutoinit !== "false") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => entry_default.init(), { once: true });
  } else {
    entry_default.init();
  }
}
export {
  DEFAULT_OPTIONS,
  DEFAULT_STRINGS,
  WaveformSounds,
  decodePeaks,
  index_default as default,
  encodePeaks,
  facets,
  formatDuration,
  matches,
  normalizeKey,
  normalizeSounds,
  parseManifest,
  renderSounds,
  renderSoundsElement,
  sortSounds
};
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
