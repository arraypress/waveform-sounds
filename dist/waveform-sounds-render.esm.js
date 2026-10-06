// ../../Core/text/src/index.js
var HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
});
function escapeHtml(input) {
  if (input === null || input === void 0) return "";
  return String(input).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

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
    waveform: input.waveform ? String(input.waveform) : null,
    download: input.download ? String(input.download) : null
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
var SORTS = ["default", "title", "bpm", "key", "duration"];

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
  download: "Download {title}",
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
var ICON_DOWNLOAD = '<svg class="ws-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 4h2v8.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z"/></svg>';
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
    sound.download ? `data-download="${escapeHtml(sound.download)}"` : "",
    hidden ? "hidden" : ""
  ].filter(Boolean).join(" ");
  const cols = o.columns.map((c) => {
    if (c === "type") return `<span class="ws-cell ws-type">${escapeHtml(sound.type)}</span>`;
    if (c === "bpm") return `<span class="ws-cell ws-bpm">${sound.bpm != null ? escapeHtml(sound.bpm) : ""}</span>`;
    if (c === "key") return `<span class="ws-cell ws-key">${escapeHtml(sound.key)}</span>`;
    return `<span class="ws-cell ws-duration">${escapeHtml(formatDuration(sound.duration))}</span>`;
  }).join("");
  const wave = o.player === "inline" ? `<span class="ws-wave" role="slider" aria-label="${escapeHtml(fill(s.seek, { title: sound.title }))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="-1"><canvas class="ws-canvas" aria-hidden="true"></canvas></span>` : "";
  return `<li ${attrs}><button type="button" class="ws-play" aria-pressed="false" aria-label="${escapeHtml(fill(s.play, { title: sound.title }))}">${ICON_PLAY}${ICON_PAUSE}</button><span class="ws-cell ws-title">${escapeHtml(sound.title)}</span>` + (cols ? `<span class="ws-cells">${cols}</span>` : "") + wave + (sound.download ? `<a class="ws-download" href="${escapeHtml(sound.download)}" download aria-label="${escapeHtml(fill(s.download, { title: sound.title }))}">${ICON_DOWNLOAD}</a>` : "") + `</li>`;
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
  const id = o.idPrefix || idBase(list);
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
export {
  DEFAULT_STRINGS,
  decodePeaks,
  encodePeaks,
  escapeHtml,
  facets,
  formatDuration,
  normalizeKey,
  normalizeSounds,
  parseManifest,
  renderSounds,
  renderSoundsElement
};
