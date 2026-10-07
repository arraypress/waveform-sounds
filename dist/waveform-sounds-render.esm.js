// node_modules/@arraypress/text/src/index.js
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

// src/js/data/sounds.js
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
  if (s > 0 && s < 0.95) return `${Math.max(0.1, Math.round(s * 10) / 10).toFixed(1)}s`;
  const total = s < 1 ? Math.ceil(s) : Math.floor(s);
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
    download: input.download ? String(input.download) : null,
    loop: isLoop(input.loop)
  };
}
function isLoop(value) {
  return value === true || value === 1 || value === "true" || value === "1";
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
  let min = Infinity, max = -Infinity, hasDuration = false, loops = 0;
  for (const s of sounds) {
    if (s.type) types.set(s.type, (types.get(s.type) || 0) + 1);
    if (s.key) keys.add(s.key);
    if (s.bpm != null) {
      min = Math.min(min, s.bpm);
      max = Math.max(max, s.bpm);
    }
    if (s.duration != null) hasDuration = true;
    if (s.loop) loops++;
  }
  return {
    types: [...types].map(([name, count]) => ({ name, count })),
    keys: [...keys].sort((a, b) => keyRank(a) - keyRank(b) || a.localeCompare(b)),
    bpm: min === Infinity ? null : { min, max },
    hasDuration,
    loops,
    oneShots: sounds.length - loops
  };
}
var SORTS = ["default", "title", "bpm", "key", "duration"];
var SORT_NEEDS = {
  default: () => true,
  title: () => true,
  bpm: (f) => f.bpm !== null,
  key: (f) => f.keys.length > 0,
  duration: (f) => f.hasDuration
};
function availableSorts(sorts, f) {
  return sorts.filter((sort) => SORT_NEEDS[sort]?.(f));
}

// src/js/render/html.js
var VOID = /* @__PURE__ */ new Set(["input", "br", "img"]);
function text(value) {
  return escapeHtml(value ?? "");
}
function attrs(map = {}) {
  let out = "";
  for (const [name, value] of Object.entries(map)) {
    if (value === true) out += ` ${name}`;
    else if (value !== false && value != null) out += ` ${name}="${escapeHtml(value)}"`;
  }
  return out;
}
function h(tag, attributes = {}, ...children) {
  const open = `<${tag}${attrs(attributes)}>`;
  if (VOID.has(tag)) return open;
  return open + children.flat(Infinity).filter((c) => c != null && c !== false && c !== "").join("") + `</${tag}>`;
}

// src/js/render/icons.js
function icon(path, extraClass = "") {
  const cls = extraClass ? `ws-icon ${extraClass}` : "ws-icon";
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
}
var ICONS = {
  play: icon("M8 5.5v13l11-6.5z", "ws-icon-play"),
  pause: icon("M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", "ws-icon-pause"),
  search: icon("M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"),
  chevron: icon("M6.4 8.6 12 14.2l5.6-5.6L19 10l-7 7-7-7z", "ws-menu-chevron"),
  check: icon("M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z", "ws-menu-check"),
  download: icon("M11 4h2v8.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3zM5 18h14v2H5z"),
  loop: icon("M17 4l3 3-3 3V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V4zM7 20l-3-3 3-3v2h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v2z")
};

// src/js/data/bpm.js
function bpmRangeFromFilter(filter, extent) {
  const read = (v, fallback) => {
    const n = Number(v);
    return v === "" || v == null || !Number.isFinite(n) ? fallback : Math.min(Math.max(n, extent.min), extent.max);
  };
  const lo = read(filter.bpmMin, extent.min);
  const hi = read(filter.bpmMax, extent.max);
  return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}
function hasBpmFilter(filter) {
  return filter.bpmMin != null && filter.bpmMin !== "" || filter.bpmMax != null && filter.bpmMax !== "";
}

// src/js/render/strings.js
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
  anyBpm: "Any BPM",
  bpmRange: "{min}\u2013{max} BPM",
  sort: "Sort",
  sortBy: "Sort by",
  sortDefault: "Default",
  sortTitle: "Name",
  sortBpm: "BPM",
  sortKey: "Key",
  sortDuration: "Length",
  loop: "Loop",
  loopFilter: "Loops or one-shots",
  loops: "Loops",
  oneShots: "One-shots",
  isLoop: "Loop",
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
var SORT_LABEL_KEYS = {
  default: "sortDefault",
  title: "sortTitle",
  bpm: "sortBpm",
  key: "sortKey",
  duration: "sortDuration"
};
function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => name in vars ? String(vars[name]) : match);
}
function bpmLabel(filter, extent, strings = DEFAULT_STRINGS) {
  if (!hasBpmFilter(filter)) return strings.anyBpm;
  const { lo, hi } = bpmRangeFromFilter(filter, extent);
  return fill(strings.bpmRange, { min: lo, max: hi });
}
function countText(shown, total, strings = DEFAULT_STRINGS) {
  if (shown !== total) return fill(strings.countFiltered, { count: shown, total });
  return total === 1 ? strings.countOne : fill(strings.count, { count: total });
}

// src/js/render/options.js
var FILTERS = ["type", "key", "bpm", "loop"];
var COLUMNS = ["type", "bpm", "key", "duration"];
var RENDER_DEFAULTS = {
  player: "inline",
  search: true,
  filters: [...FILTERS],
  sorts: [...SORTS],
  loopToggle: true,
  showCount: true,
  menuSearch: 8,
  pageSize: 50,
  columns: [...COLUMNS],
  maxTypeChips: 10
};
function defined(obj) {
  const out = {};
  for (const k in obj ?? {}) if (obj[k] !== void 0) out[k] = obj[k];
  return out;
}
function allowedList(values, allowed, fallback) {
  return Array.isArray(values) ? values.filter((v) => allowed.includes(v)) : fallback;
}
function wholeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
function resolveRenderOptions(options = {}) {
  const o = { ...RENDER_DEFAULTS, ...defined(options) };
  return {
    ...o,
    player: o.player === "strip" ? "strip" : "inline",
    filters: allowedList(o.filters, FILTERS, RENDER_DEFAULTS.filters),
    sorts: allowedList(o.sorts, SORTS, RENDER_DEFAULTS.sorts),
    columns: allowedList(o.columns, COLUMNS, RENDER_DEFAULTS.columns),
    menuSearch: wholeNumber(o.menuSearch, RENDER_DEFAULTS.menuSearch),
    maxTypeChips: wholeNumber(o.maxTypeChips, RENDER_DEFAULTS.maxTypeChips),
    pageSize: wholeNumber(o.pageSize, RENDER_DEFAULTS.pageSize),
    strings: { ...DEFAULT_STRINGS, ...defined(options.strings) }
  };
}

// src/js/shared/utils.js
function hashString(str) {
  let hash = 5381;
  for (const char of str) hash = hash * 33 + char.codePointAt(0) >>> 0;
  return hash;
}

// src/js/render/markup.js
function idBase(sounds) {
  const signature = [sounds.length, ...sounds.map((s) => s.url)].join("|");
  return `ws${hashString(signature).toString(36)}`;
}
function toolbarPlan(f, o) {
  const typed = o.filters.includes("type") && f.types.length > 1;
  const sorts = availableSorts(o.sorts, f);
  return {
    types: !typed ? null : f.types.length > o.maxTypeChips ? "menu" : "chips",
    key: o.filters.includes("key") && f.keys.length > 1,
    bpm: o.filters.includes("bpm") && f.bpm !== null && f.bpm.max > f.bpm.min,
    loops: o.filters.includes("loop") && f.loops > 0 && f.oneShots > 0,
    sorts: sorts.length > 1 ? sorts : [],
    search: !!o.search,
    loop: !!o.loopToggle,
    count: !!o.showCount
  };
}
function loopsByDefault(loop, f) {
  return loop == null ? f.loops > 0 : !!loop;
}
function renderSearch(s) {
  return h(
    "label",
    { class: "ws-search" },
    ICONS.search,
    h("span", { class: "ws-sr" }, text(s.search)),
    h("input", { type: "search", class: "ws-search-input", "data-ws-search": true, placeholder: s.searchPlaceholder, autocomplete: "off", spellcheck: "false" })
  );
}
function renderMenu(name, m) {
  const listId = `${m.id}-${name}-list`;
  const current = m.options.find((o) => o.value === m.value) ?? m.options[0];
  const searchable = m.placeholder && m.options.length > m.searchFrom;
  const button = h(
    "button",
    { type: "button", class: "ws-menu-btn", "data-ws-menu-btn": true, "aria-haspopup": "listbox", "aria-expanded": "false", "aria-controls": listId },
    m.prefix ? h("span", { class: "ws-menu-prefix" }, text(m.prefix)) : h("span", { class: "ws-sr" }, text(`${m.label}: `)),
    h("span", { class: "ws-menu-value", "data-ws-menu-value": true }, text(current.label)),
    ICONS.chevron
  );
  const search = searchable && h("input", {
    type: "search",
    class: "ws-menu-search",
    "data-ws-menu-search": true,
    role: "combobox",
    "aria-expanded": "true",
    "aria-controls": listId,
    "aria-autocomplete": "list",
    "aria-label": m.placeholder,
    placeholder: m.placeholder,
    autocomplete: "off",
    spellcheck: "false"
  });
  const options = m.options.map((o, i) => h(
    "li",
    { role: "option", id: `${m.id}-${name}-${i}`, class: "ws-menu-option", "data-value": o.value, "aria-selected": String(o === current) },
    ICONS.check,
    h("span", { class: "ws-menu-text" }, text(o.label)),
    o.count != null && h("span", { class: "ws-menu-count" }, text(o.count))
  ));
  return h(
    "div",
    { class: "ws-menu", "data-ws-menu": name },
    button,
    h(
      "div",
      { class: "ws-menu-pop", "data-ws-menu-pop": true, hidden: true },
      search,
      h("ul", { class: "ws-menu-list", role: "listbox", id: listId, "aria-label": m.label, tabindex: "-1", "data-ws-menu-list": true }, options),
      h("p", { class: "ws-menu-none", "data-ws-menu-none": true, hidden: true }, text(m.noMatches))
    )
  );
}
function renderBpmMenu({ id, s, range }) {
  const popId = `${id}-bpm-pop`;
  const handle = (attr, label, value) => h("input", {
    type: "range",
    class: "ws-range-input",
    [attr]: true,
    "aria-label": label,
    min: range.min,
    max: range.max,
    step: "1",
    value
  });
  return h(
    "div",
    { class: "ws-menu ws-menu--bpm", "data-ws-menu": "bpm" },
    h(
      "button",
      { type: "button", class: "ws-menu-btn", "data-ws-menu-btn": true, "aria-haspopup": "dialog", "aria-expanded": "false", "aria-controls": popId },
      h("span", { class: "ws-sr" }, text(`${s.bpm}: `)),
      h("span", { class: "ws-menu-value", "data-ws-menu-value": true }, text(bpmLabel({}, range, s))),
      ICONS.chevron
    ),
    h(
      "div",
      { class: "ws-menu-pop ws-bpm-pop", id: popId, role: "dialog", "aria-label": s.bpm, "data-ws-menu-pop": true, hidden: true },
      h(
        "div",
        { class: "ws-bpm-head" },
        h("span", { class: "ws-bpm-readout", "data-ws-bpm-readout": true, "aria-live": "polite" }, text(fill(s.bpmRange, range))),
        h("button", { type: "button", class: "ws-bpm-clear", "data-ws-bpm-clear": true }, text(s.anyBpm))
      ),
      h(
        "div",
        { class: "ws-range", "data-ws-bpm-range": true },
        handle("data-ws-bpm-min", s.bpmMin, range.min),
        handle("data-ws-bpm-max", s.bpmMax, range.max)
      ),
      h("div", { class: "ws-range-ends", "aria-hidden": "true" }, h("span", {}, text(range.min)), h("span", {}, text(range.max)))
    )
  );
}
function renderLoopFilter(s) {
  const button = (value, label) => h(
    "button",
    { type: "button", class: "ws-seg-btn", "data-ws-loop-filter": value, "aria-pressed": String(value === "") },
    h("span", {}, text(label))
  );
  return h(
    "div",
    { class: "ws-seg", role: "group", "aria-label": s.loopFilter },
    button("", s.all),
    button("loop", s.loops),
    button("one-shot", s.oneShots)
  );
}
function renderLoopToggle(s, pressed) {
  return h("button", { type: "button", class: "ws-loop", "data-ws-loop": true, "aria-pressed": String(pressed) }, ICONS.loop, h("span", {}, text(s.loop)));
}
function renderChip(value, label, count, pressed) {
  return h(
    "button",
    { type: "button", class: "ws-chip", "data-ws-type": value, "aria-pressed": String(pressed) },
    h("span", { class: "ws-chip-label" }, text(label)),
    " ",
    h("span", { class: "ws-chip-count" }, text(count))
  );
}
function renderToolbar(plan, { o, s, f, total, id }) {
  const menu = (name, m) => renderMenu(name, { id, searchFrom: o.menuSearch, noMatches: s.noMatches, ...m });
  const controls = [
    plan.types === "menu" && menu("type", {
      label: s.types,
      value: "",
      placeholder: s.findType,
      options: [{ value: "", label: s.allTypes, count: total }, ...f.types.map((t) => ({ value: t.name, label: t.name, count: t.count }))]
    }),
    plan.key && menu("key", {
      label: s.key,
      value: "",
      placeholder: s.findKey,
      options: [{ value: "", label: s.anyKey }, ...f.keys.map((k) => ({ value: k, label: k }))]
    }),
    plan.bpm && renderBpmMenu({ id, s, range: f.bpm }),
    plan.loops && renderLoopFilter(s),
    plan.sorts.length > 0 && menu("sort", {
      label: s.sort,
      prefix: s.sortBy,
      value: plan.sorts[0],
      options: plan.sorts.map((k) => ({ value: k, label: s[SORT_LABEL_KEYS[k]] }))
    }),
    plan.loop && renderLoopToggle(s, loopsByDefault(o.loop, f))
  ].filter(Boolean);
  const chips = plan.types === "chips" && h(
    "div",
    { class: "ws-types", role: "group", "aria-label": s.types },
    renderChip("", s.all, total, true),
    f.types.map((t) => renderChip(t.name, t.name, t.count, false))
  );
  const count = plan.count && h("p", { class: "ws-count", "data-ws-count": true, "aria-live": "polite" }, text(countText(total, total, s)));
  return h(
    "div",
    { class: "ws-toolbar" },
    plan.search && renderSearch(s),
    controls.length > 0 && h("div", { class: "ws-controls" }, controls),
    // The chips and the count share a row (the count alone without chips).
    (chips || count) && h("div", { class: "ws-meta" }, chips, count)
  );
}
var CELLS = {
  type: (sound) => text(sound.type),
  bpm: (sound) => text(sound.bpm ?? ""),
  key: (sound) => text(sound.key),
  duration: (sound) => text(formatDuration(sound.duration))
};
function renderRow(sound, index, o, hidden = false) {
  const s = o.strings;
  const vars = { title: sound.title };
  const cells = o.columns.map((c) => h("span", { class: `ws-cell ws-${c}` }, CELLS[c](sound)));
  return h(
    "li",
    {
      class: "ws-row",
      "data-ws-index": index,
      "data-ws-id": sound.id,
      "data-url": sound.url,
      "data-title": sound.title,
      "data-type": sound.type || null,
      "data-bpm": sound.bpm,
      "data-key": sound.key || null,
      "data-duration": sound.duration,
      "data-tags": sound.tags?.length ? sound.tags.join(",") : null,
      "data-peaks": sound.peaks ? encodePeaks(sound.peaks) : null,
      "data-waveform": sound.waveform,
      "data-download": sound.download,
      "data-loop": sound.loop ? "true" : null,
      hidden
    },
    h("button", { type: "button", class: "ws-play", "aria-pressed": "false", "aria-label": fill(s.play, vars) }, ICONS.play, ICONS.pause),
    h(
      "span",
      { class: "ws-cell ws-title" },
      h("span", { class: "ws-title-text" }, text(sound.title)),
      // A loop says so beside its name; a one-shot carries nothing.
      sound.loop && h("span", { class: "ws-loop-mark", title: s.isLoop }, ICONS.loop, h("span", { class: "ws-sr" }, text(s.isLoop)))
    ),
    // Wide rows: `display: contents` makes each cell a column. Narrow
    // rows: one line under the title.
    cells.length > 0 && h("span", { class: "ws-cells" }, cells),
    o.player === "inline" && h(
      "span",
      { class: "ws-wave", role: "slider", "aria-label": fill(s.seek, vars), "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0", tabindex: "-1" },
      h("canvas", { class: "ws-canvas", "aria-hidden": "true" })
    ),
    // Optional, per sound: a plain link. Rows without one carry nothing.
    sound.download && h("a", { class: "ws-download", href: sound.download, download: true, "aria-label": fill(s.download, vars) }, ICONS.download)
  );
}
function renderFooter({ o, s, total }) {
  const page = o.pageSize > 0 ? o.pageSize : total;
  const more = Math.max(0, total - page);
  const strip = o.player === "strip";
  return [
    h(
      "p",
      { class: "ws-empty", "data-ws-empty": true, hidden: true },
      text(s.empty),
      " ",
      h("button", { type: "button", class: "ws-clear", "data-ws-clear": true }, text(s.clear))
    ),
    h("button", { type: "button", class: "ws-more", "data-ws-more": true, hidden: more === 0 }, text(fill(s.showMore, { count: Math.min(more, page) }))),
    h("div", { class: strip ? "ws-engine ws-engine--strip" : "ws-engine", "data-ws-engine": true, hidden: !strip }),
    h("p", { class: "ws-sr", "data-ws-status": true, "aria-live": "polite" })
  ].join("");
}
function renderSounds(sounds, options = {}) {
  const o = resolveRenderOptions(options);
  const list = normalizeSounds(sounds);
  const ctx = { o, s: o.strings, f: facets(list), total: list.length, id: o.idPrefix || idBase(list) };
  const page = o.pageSize > 0 ? o.pageSize : Infinity;
  return renderToolbar(toolbarPlan(ctx.f, o), ctx) + h(
    "ul",
    { class: `ws-list ws-list--${o.player}`, role: "list", "data-ws-list": true },
    list.map((sound, i) => renderRow(sound, i, o, i >= page))
  ) + renderFooter(ctx);
}
function renderSoundsElement(sounds, options = {}, className = "") {
  const o = resolveRenderOptions(options);
  const cls = ["waveform-sounds", `waveform-sounds--${o.player}`, className].filter(Boolean).join(" ");
  return h("div", { class: cls, "data-waveform-sounds": true, "data-player": o.player }, renderSounds(sounds, options));
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
