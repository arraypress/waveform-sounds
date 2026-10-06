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
var NOT_A_WORD = /[^\p{L}\p{N}]+/u;
var COMBINING_MARKS = /\p{Mn}+/gu;
function fold(text2) {
  if (!text2 || typeof text2 !== "string") return "";
  return text2.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}
function words(text2) {
  return fold(text2).split(NOT_A_WORD).filter((word) => word !== "");
}
function editDistance(a, b) {
  const s = Array.from(a ?? "");
  const t = Array.from(b ?? "");
  let before = [];
  let previous = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const current = [i];
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        current[j] = Math.min(current[j], before[j - 2] + 1);
      }
    }
    before = previous;
    previous = current;
  }
  return previous[t.length];
}
function matchesAll(name, query, options = {}) {
  const fuzzyFrom = options.fuzzyFrom ?? 4;
  const folded = fold(name);
  const nameWords = words(name);
  return words(query).every((term) => {
    if (folded.includes(term)) return true;
    const length = Array.from(term).length;
    if (length < fuzzyFrom) return false;
    return nameWords.some(
      (word) => editDistance(term, word) <= 1 || editDistance(term, Array.from(word).slice(0, length).join("")) <= 1
    );
  });
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
function matches(sound, filter = {}) {
  if (filter.type && sound.type !== filter.type) return false;
  if (filter.key && sound.key !== normalizeKey(filter.key)) return false;
  const lo = Number(filter.bpmMin), hi = Number(filter.bpmMax);
  if (filter.bpmMin != null && filter.bpmMin !== "" && Number.isFinite(lo) || filter.bpmMax != null && filter.bpmMax !== "" && Number.isFinite(hi)) {
    if (sound.bpm == null) return false;
    if (filter.bpmMin != null && filter.bpmMin !== "" && sound.bpm < lo) return false;
    if (filter.bpmMax != null && filter.bpmMax !== "" && sound.bpm > hi) return false;
  }
  const terms = words(filter.query || "");
  if (terms.length) {
    const hay = [sound.title, sound.type, sound.key, ...sound.tags || []].join(" ");
    const folded = fold(hay);
    const rest = terms.filter((w) => !(/^\d+$/.test(w) && !folded.includes(w) && sound.bpm != null && Math.round(sound.bpm) === Number(w)));
    if (rest.length && !matchesAll(hay, rest.join(" "))) return false;
  }
  return true;
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

// src/js/dom/draw.js
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(rect.width * dpr), h2 = Math.round(rect.height * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h2) canvas.height = h2;
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
function barRects(peaks, width, height, o) {
  const step = o.barWidth + o.barGap;
  const bars = resample(peaks, Math.max(1, Math.floor((width + o.barGap) / step)));
  const max = bars.reduce((m, b) => b > m ? b : m, 0);
  const scale = max > 0 ? 1 / max : 1;
  return bars.map((b, i) => {
    const v = Math.max(b * scale, 0.04);
    if (o.style === "bars") {
      const h3 = Math.max(1, v * height);
      return { x: i * step, y: height - h3, w: o.barWidth, h: h3 };
    }
    const h2 = Math.max(1, v * (height - 2));
    return { x: i * step, y: height / 2 - h2 / 2, w: o.barWidth, h: h2 };
  });
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

// src/js/core/engine.js
var CALLBACKS = ["onLoad", "onPlay", "onPause", "onEnd", "onTimeUpdate", "onError"];
function engineOptions(user, layout, handlers) {
  const site = user || {};
  const strip = layout === "strip";
  const options = {
    height: strip ? 48 : 32,
    waveformStyle: strip ? "mirror" : "bars",
    preload: "metadata",
    singlePlay: true,
    ...site,
    audioMode: "self"
  };
  for (const name of CALLBACKS) {
    options[name] = (...args) => {
      handlers[name]?.(...args);
      if (typeof site[name] === "function") site[name](...args);
    };
  }
  return options;
}
function enginePeaks(sound, layout) {
  return layout === "strip" && sound.waveform || sound.peaks || null;
}

// src/js/dom/menus.js
function optionMatches(label, query) {
  const q = fold(String(query ?? "")).trim();
  return !q || fold(String(label ?? "")).includes(q);
}
function stepIndex(current, delta, length) {
  return Math.max(0, Math.min(length - 1, current + delta));
}
function partsOf(menu) {
  return {
    button: menu.querySelector("[data-ws-menu-btn]"),
    pop: menu.querySelector("[data-ws-menu-pop]"),
    search: menu.querySelector("[data-ws-menu-search]"),
    list: menu.querySelector("[data-ws-menu-list]"),
    none: menu.querySelector("[data-ws-menu-none]"),
    value: menu.querySelector("[data-ws-menu-value]")
  };
}
var focusOwner = (p) => p.search || p.list;
var optionsOf = (p, visibleOnly = false) => [...p.list.querySelectorAll('[role="option"]')].filter((o) => !visibleOnly || !o.hidden);
var Menus = class {
  /**
   * @param {HTMLElement} container - The list's root element.
   * @param {Object} opts
   * @param {(name: string, value: string) => void} opts.onPick - A value was chosen.
   * @param {AbortSignal} opts.signal - Removes every listener on abort.
   */
  constructor(container, { onPick, signal }) {
    this.container = container;
    this.onPick = onPick;
    this.menus = Object.fromEntries([...container.querySelectorAll("[data-ws-menu]")].map((m) => [m.dataset.wsMenu, m]));
    this.openMenu = null;
    this._bind(signal);
  }
  /**
   * Wire every menu, plus closing on an outside press or focus leaving.
   * @param {AbortSignal} signal
   * @private
   */
  _bind(signal) {
    const sig = { signal };
    for (const [name, menu] of Object.entries(this.menus)) {
      const p = partsOf(menu);
      p.button.addEventListener("click", () => this.openMenu === menu ? this.close(true) : this.open(menu), sig);
      p.button.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          this.open(menu);
        }
      }, sig);
      p.list.addEventListener("click", (e) => {
        const opt = e.target.closest('[role="option"]');
        if (opt) this._pick(name, opt.dataset.value);
      }, sig);
      p.list.addEventListener("mousedown", (e) => e.preventDefault(), sig);
      p.search?.addEventListener("input", () => this._filter(menu, p.search.value), sig);
      focusOwner(p).addEventListener("keydown", (e) => this._onKey(e, name, menu), sig);
    }
    document.addEventListener("pointerdown", (e) => {
      if (this.openMenu && !this.openMenu.contains(e.target)) this.close(false);
    }, sig);
    this.container.addEventListener("focusout", (e) => {
      if (this.openMenu && !this.openMenu.contains(e.relatedTarget)) this.close(false);
    }, sig);
  }
  /**
   * Open a menu (closing any other), with the selected option active and
   * focus in its search field or list. Flips to open over the end edge
   * when it would overflow the list.
   *
   * @param {HTMLElement} menu
   */
  open(menu) {
    if (this.openMenu && this.openMenu !== menu) this.close(false);
    const p = partsOf(menu);
    p.button.setAttribute("aria-expanded", "true");
    p.pop.hidden = false;
    this.openMenu = menu;
    if (p.search) {
      p.search.value = "";
      this._filter(menu, "");
    }
    menu.classList.remove("ws-menu--end");
    if (p.pop.getBoundingClientRect().right > this.container.getBoundingClientRect().right + 1) menu.classList.add("ws-menu--end");
    this._activate(menu, p.list.querySelector('[role="option"][aria-selected="true"]'));
    focusOwner(p).focus();
  }
  /**
   * Close the open menu, if any.
   *
   * @param {boolean} focusButton - Return focus to its button (after a
   *   pick or Esc; not after a click elsewhere).
   */
  close(focusButton) {
    const menu = this.openMenu;
    if (!menu) return;
    this.openMenu = null;
    const p = partsOf(menu);
    p.pop.hidden = true;
    p.button.setAttribute("aria-expanded", "false");
    if (focusButton) p.button.focus();
  }
  /**
   * Show `value` as a menu's choice (button text + `aria-selected`). Used
   * after a pick and when the filter is changed from code.
   *
   * @param {string} name - 'type' | 'key' | 'sort'.
   * @param {string} value
   */
  setValue(name, value) {
    const menu = this.menus[name];
    if (!menu) return;
    const p = partsOf(menu);
    let label = null;
    for (const opt of optionsOf(p)) {
      const on = opt.dataset.value === String(value ?? "");
      opt.setAttribute("aria-selected", String(on));
      if (on) label = opt.querySelector(".ws-menu-text")?.textContent ?? "";
    }
    if (label !== null) p.value.textContent = label;
  }
  /**
   * Narrow a menu to the options matching the search, and make the first
   * match active.
   * @private
   */
  _filter(menu, query) {
    const p = partsOf(menu);
    let first = null;
    for (const opt of optionsOf(p)) {
      opt.hidden = !optionMatches(opt.textContent, query);
      if (!opt.hidden) first ??= opt;
    }
    p.none.hidden = first !== null;
    this._activate(menu, first);
  }
  /**
   * Mark one option active (`aria-activedescendant`) and scroll it into
   * the list's view.
   * @private
   */
  _activate(menu, opt) {
    const p = partsOf(menu);
    for (const o of p.list.querySelectorAll(".is-active")) o.classList.remove("is-active");
    const owner = focusOwner(p);
    if (!opt || opt.hidden) {
      owner.removeAttribute("aria-activedescendant");
      return;
    }
    opt.classList.add("is-active");
    owner.setAttribute("aria-activedescendant", opt.id);
    opt.scrollIntoView?.({ block: "nearest" });
  }
  /**
   * Keys inside an open menu.
   * @private
   */
  _onKey(e, name, menu) {
    const p = partsOf(menu);
    const opts = optionsOf(p, true);
    const at = opts.indexOf(p.list.querySelector(".is-active"));
    const moveTo = (i) => {
      e.preventDefault();
      this._activate(menu, opts[i]);
    };
    const inField = e.target.matches("input");
    switch (e.key) {
      case "ArrowDown":
        return moveTo(stepIndex(at, 1, opts.length));
      case "ArrowUp":
        return moveTo(stepIndex(at, -1, opts.length));
      case "Home":
        return inField ? void 0 : moveTo(0);
      case "End":
        return inField ? void 0 : moveTo(opts.length - 1);
      case "Enter":
        e.preventDefault();
        if (at >= 0) this._pick(name, opts[at].dataset.value);
        return void 0;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return this.close(true);
      case "Tab":
        return this.close(false);
      default:
        return void 0;
    }
  }
  /**
   * A value was chosen: close, then report it.
   * @private
   */
  _pick(name, value) {
    this.close(true);
    this.onPick(name, value);
  }
};

// src/js/shared/utils.js
var LOG = "[WaveformSounds]";
function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}
function pointerFraction(clientX, rect) {
  return rect && rect.width ? clamp((clientX - rect.left) / rect.width) : 0;
}
function isTyping(el) {
  return !!el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
}
function emit(target, name, detail) {
  const event = new CustomEvent(`waveformsounds:${name}`, { bubbles: true, detail });
  target.dispatchEvent(event);
  return event;
}
function hashString(str) {
  let hash = 5381;
  for (const char of str) hash = hash * 33 + char.codePointAt(0) >>> 0;
  return hash;
}

// src/js/data/navigation.js
var SEEK_STEP = 0.1;
function rowTarget(key, at, count) {
  if (!count) return null;
  switch (key) {
    case "ArrowDown":
      return at + 1 < count ? at + 1 : null;
    case "ArrowUp":
      return at > 0 ? at - 1 : "search";
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
function seekTarget(progress, key) {
  if (key !== "ArrowRight" && key !== "ArrowLeft") return null;
  return clamp(progress + (key === "ArrowRight" ? SEEK_STEP : -SEEK_STEP), 0, 0.999);
}
function pageWindow(shown, limit) {
  const visible = new Set(shown.slice(0, limit));
  return { visible, remaining: shown.length - visible.size };
}
function limitToReveal(limit, pos) {
  return pos >= limit ? pos + 1 : limit;
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
function countText(shown, total, strings = DEFAULT_STRINGS) {
  if (shown !== total) return fill(strings.countFiltered, { count: shown, total });
  return total === 1 ? strings.countOne : fill(strings.count, { count: total });
}

// src/js/render/options.js
var FILTERS = ["type", "key", "bpm"];
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

// src/js/core/options.js
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
  idPrefix: null,
  urlState: false,
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
function parseBool(value) {
  if (value === "" || value === "true") return true;
  if (value === "false") return false;
  return void 0;
}
function parseList(value) {
  if (value == null) return void 0;
  return value.split(",").map((x) => x.trim()).filter(Boolean);
}
function parseNumber(value) {
  return value === void 0 || value === "" ? void 0 : Number(value);
}
function parseUrlState(value) {
  if (value === void 0) return void 0;
  const b = parseBool(value);
  return b === void 0 ? value : b;
}
function parseJson(value, name) {
  if (!value) return void 0;
  try {
    return JSON.parse(value);
  } catch {
    console.warn(`${LOG} Ignoring invalid JSON in data-${name}`);
    return void 0;
  }
}
function readDataOptions(el) {
  const d = el.dataset || {};
  const out = {
    player: d.player || void 0,
    manifest: d.manifest || void 0,
    search: parseBool(d.search),
    filters: parseList(d.filters),
    sorts: parseList(d.sorts),
    showCount: parseBool(d.showCount),
    menuSearch: parseNumber(d.menuSearch),
    idPrefix: d.idPrefix || void 0,
    urlState: parseUrlState(d.urlState),
    loopToggle: parseBool(d.loopToggle),
    pageSize: parseNumber(d.pageSize),
    maxTypeChips: parseNumber(d.maxTypeChips),
    columns: parseList(d.columns),
    waveformStyle: d.waveformStyle || void 0,
    waveformColor: d.waveformColor || void 0,
    progressColor: d.progressColor || void 0,
    barWidth: parseNumber(d.barWidth),
    barGap: parseNumber(d.barGap),
    loop: parseBool(d.loop),
    autoAdvance: parseBool(d.autoAdvance),
    arrowAudition: parseBool(d.arrowAudition),
    strings: parseJson(d.strings, "strings"),
    playerOptions: parseJson(d.playerOptions, "player-options")
  };
  for (const k of Object.keys(out)) if (out[k] === void 0) delete out[k];
  return out;
}
function mergeOptions(...sources) {
  const out = {};
  for (const src of sources) {
    if (!src) continue;
    for (const k in src) if (src[k] !== null && src[k] !== void 0) out[k] = src[k];
  }
  return out;
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
    sorts: sorts.length > 1 ? sorts : [],
    search: !!o.search,
    loop: !!o.loopToggle,
    count: !!o.showCount
  };
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
function renderBpmRange(s, range) {
  const field = (attr, label, placeholder) => h("input", { type: "number", inputmode: "numeric", [attr]: true, "aria-label": label, placeholder, min: "0", step: "1" });
  return h(
    "span",
    { class: "ws-bpm-range", role: "group", "aria-label": s.bpm },
    field("data-ws-bpm-min", s.bpmMin, range.min),
    h("span", { "aria-hidden": "true" }, "\u2013"),
    field("data-ws-bpm-max", s.bpmMax, range.max),
    h("span", { class: "ws-bpm-unit", "aria-hidden": "true" }, text(s.bpm))
  );
}
function renderLoopToggle(s) {
  return h("button", { type: "button", class: "ws-loop", "data-ws-loop": true, "aria-pressed": "false" }, ICONS.loop, h("span", {}, text(s.loop)));
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
    plan.bpm && renderBpmRange(s, f.bpm),
    plan.sorts.length > 0 && menu("sort", {
      label: s.sort,
      prefix: s.sortBy,
      value: plan.sorts[0],
      options: plan.sorts.map((k) => ({ value: k, label: s[SORT_LABEL_KEYS[k]] }))
    }),
    plan.loop && renderLoopToggle(s)
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
      hidden
    },
    h("button", { type: "button", class: "ws-play", "aria-pressed": "false", "aria-label": fill(s.play, vars) }, ICONS.play, ICONS.pause),
    h("span", { class: "ws-cell ws-title" }, text(sound.title)),
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

// src/js/dom/rows.js
var ROW = ":scope > [data-ws-index]";
function readRows(list) {
  const rows = [...list.querySelectorAll(ROW)].sort((a, b) => Number(a.dataset.wsIndex) - Number(b.dataset.wsIndex));
  const sounds = [];
  for (const row of rows) {
    const d = row.dataset;
    const sound = normalizeSound({
      id: d.wsId,
      url: d.url,
      title: d.title,
      type: d.type,
      bpm: d.bpm,
      key: d.key,
      duration: d.duration,
      tags: d.tags,
      peaks: d.peaks,
      waveform: d.waveform,
      download: d.download
    }, sounds.length);
    if (!sound) {
      row.remove();
      continue;
    }
    row.dataset.wsIndex = String(sounds.length);
    sounds.push(sound);
  }
  return sounds;
}
function indexRows(list) {
  const rows = [];
  list.querySelectorAll(ROW).forEach((row) => {
    rows[Number(row.dataset.wsIndex)] = row;
  });
  return rows;
}
function visibleRows(list) {
  return [...list.querySelectorAll(ROW)].filter((r) => !r.hidden);
}
function orderRows(list, rows) {
  const frag = document.createDocumentFragment();
  for (const row of rows) if (row) frag.appendChild(row);
  list.appendChild(frag);
}

// src/js/dom/colors.js
function parseAlpha(color) {
  const c = String(color ?? "").trim();
  if (!c || c === "transparent") return 0;
  const slash = c.match(/\/\s*([\d.]+)(%?)\s*\)$/);
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
  const rgba = c.match(/^rgba\(\s*[^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
  if (rgba) return Number(rgba[1]);
  return 1;
}
function pageSurface(el, minAlpha = 0.95) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement || node.getRootNode?.().host) {
    const bg = getComputedStyle(node).backgroundColor;
    if (parseAlpha(bg) > minAlpha) return bg;
  }
  return "#fff";
}
function resolveCssColor(container, value) {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
  probe.style.color = value;
  container.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

// src/js/data/url-state.js
function urlKeys(urlState) {
  if (!urlState) return null;
  const p = typeof urlState === "string" ? `${urlState}-` : "";
  return { q: `${p}q`, type: `${p}type`, key: `${p}key`, bpm: `${p}bpm`, sort: `${p}sort` };
}
function parseBpmRange(value) {
  const m = String(value ?? "").match(/^(\d*)-(\d*)$/);
  return m && (m[1] || m[2]) ? { bpmMin: m[1], bpmMax: m[2] } : null;
}
function formatBpmRange(min, max) {
  const lo = min ?? "", hi = max ?? "";
  return lo !== "" || hi !== "" ? `${lo}-${hi}` : "";
}
function readUrlState(search, keys, available, sorts) {
  const out = { filter: {}, sort: null };
  if (!keys) return out;
  const sp = new URLSearchParams(search);
  const q = sp.get(keys.q);
  if (q) out.filter.query = q;
  const type = sp.get(keys.type);
  if (type && available.types.some((t) => t.name === type)) out.filter.type = type;
  const key = normalizeKey(sp.get(keys.key));
  if (key && available.keys.includes(key)) out.filter.key = key;
  const bpm = parseBpmRange(sp.get(keys.bpm));
  if (bpm) Object.assign(out.filter, bpm);
  const sort = sp.get(keys.sort);
  if (sort && sorts.includes(sort)) out.sort = sort;
  return out;
}
function writeUrlState(href, keys, filter, sort, defaultSort) {
  if (!keys) return href;
  const url = new URL(href);
  const set = (name, v) => v ? url.searchParams.set(name, v) : url.searchParams.delete(name);
  set(keys.q, String(filter.query ?? "").trim());
  set(keys.type, filter.type);
  set(keys.key, filter.key);
  set(keys.bpm, formatBpmRange(filter.bpmMin, filter.bpmMax));
  set(keys.sort, sort !== defaultSort ? sort : "");
  return url.href;
}

// src/js/core/WaveformSounds.js
var NO_FILTER = Object.freeze({ query: "", type: "", key: "", bpmMin: "", bpmMax: "" });
var SEARCH_DELAY = 120;
var BPM_DELAY = 200;
var URL_DELAY = 250;
var WaveformSounds = class _WaveformSounds {
  /** @type {Map<Element, WaveformSounds>} */
  static instances = /* @__PURE__ */ new Map();
  /**
   * @param {HTMLElement|string} container - The element (or a selector).
   * @param {import('../../../index').WaveformSoundsOptions} [options]
   */
  constructor(container, options = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) throw new Error(`${LOG} Container not found: ${container}`);
    this.container = el;
    this.options = mergeOptions(DEFAULT_OPTIONS, options, readDataOptions(el));
    this.options.waveformStyle = this.options.waveformStyle === "bars" ? "bars" : "mirror";
    this.strings = { ...DEFAULT_STRINGS, ...this.options.strings || {} };
    this.render = { ...resolveRenderOptions(this.options), strings: this.strings };
    this.sounds = [];
    this.rows = [];
    this.filter = { ...NO_FILTER };
    this.sortBy = "default";
    this.limit = this._pageSize();
    this.currentIndex = null;
    this.playing = false;
    this.progress = 0;
    this.loop = !!this.options.loop;
    this.engine = null;
    this.menus = null;
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
      this.options.onError?.(err, this);
    });
  }
  /* ── Setup ─────────────────────────────────────────────────────────── */
  /**
   * Adopt server-rendered markup or render it (from `sounds` or a fetched
   * manifest), then wire everything up.
   * @private
   */
  async _init() {
    const el = this.container;
    const adopted = el.querySelector("[data-ws-list]");
    if (adopted) {
      this.sounds = readRows(adopted);
    } else {
      this._originalHTML = el.innerHTML;
      this.sounds = await this._loadSounds();
      if (this.destroyed) return;
      el.innerHTML = renderSounds(this.sounds, { ...this.render, idPrefix: this.options.idPrefix || el.id || void 0 });
    }
    if (this.destroyed) return;
    this._addedClasses = ["waveform-sounds", `waveform-sounds--${this.render.player}`].filter((c) => !el.classList.contains(c));
    el.classList.add(...this._addedClasses);
    this._cacheRefs();
    this._bind();
    this._observe();
    this._resolveColors();
    this._setLoop(this.loop);
    this._sorts = availableSorts(this.render.sorts, facets(this.sounds));
    if (!this._sortSet) this.sortBy = this._sorts[0] || "default";
    this._readUrl();
    this._syncControls();
    this._apply({ resort: this.sortBy !== "default" });
    if (this._playerClass()) this._ensureEngine();
    this._emit("ready", { sounds: this.sounds.length });
    this.options.onReady?.(this);
  }
  /**
   * The sounds from the `sounds` option, else the `manifest` URL.
   * @returns {Promise<import('../../../index').Sound[]>}
   * @private
   */
  async _loadSounds() {
    if (this.options.sounds || !this.options.manifest) return normalizeSounds(this.options.sounds || []);
    const res = await fetch(this.options.manifest);
    if (!res.ok) throw new Error(`${LOG} Manifest ${this.options.manifest}: HTTP ${res.status}`);
    return parseManifest(await res.json());
  }
  /**
   * Look up the elements the runtime drives.
   * @private
   */
  _cacheRefs() {
    const q = (sel) => this.container.querySelector(sel);
    this.$ = {
      list: q("[data-ws-list]"),
      search: q("[data-ws-search]"),
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
    this.rows = indexRows(this.$.list);
  }
  /**
   * Every listener. All are removed by `destroy()` through one
   * AbortController.
   * @private
   */
  _bind() {
    const sig = { signal: this._ctl.signal };
    const $ = this.$;
    const root = this.container;
    root.addEventListener("click", (e) => this._onClick(e), sig);
    root.addEventListener("pointerdown", (e) => this._onPointerDown(e), sig);
    root.addEventListener("keydown", (e) => this._onKey(e), sig);
    let searchTimer = 0, bpmTimer = 0;
    $.search?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.setFilter({ query: $.search.value }), SEARCH_DELAY);
    }, sig);
    $.search?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._focusRow(visibleRows($.list)[0]);
      }
      if (e.key === "Escape" && $.search.value) {
        e.preventDefault();
        $.search.value = "";
        this.setFilter({ query: "" });
      }
    }, sig);
    const onBpm = () => {
      clearTimeout(bpmTimer);
      bpmTimer = setTimeout(() => this.setFilter({ bpmMin: $.bpmMin?.value ?? "", bpmMax: $.bpmMax?.value ?? "" }), BPM_DELAY);
    };
    $.bpmMin?.addEventListener("input", onBpm, sig);
    $.bpmMax?.addEventListener("input", onBpm, sig);
    this.menus = new Menus(root, {
      signal: this._ctl.signal,
      onPick: (name, value) => name === "sort" ? this.setSort(value) : this.setFilter({ [name]: value })
    });
    document.addEventListener("waveformplayer:play", (e) => {
      const player = e.detail?.player;
      if (player && player !== this.engine && this.playing) this.pause();
    }, sig);
  }
  /* ── Input ────────────────────────────────────────────────────────── */
  /**
   * Clicks: type chips, Show more, Clear, Loop, a touch tap on a waveform
   * (seek), and anywhere else on a row (play/pause).
   * @private
   */
  _onClick(e) {
    const t = e.target;
    const chip = t.closest("[data-ws-type]");
    if (chip) {
      this.setFilter({ type: chip.dataset.wsType });
      return;
    }
    if (t.closest("[data-ws-more]")) {
      this.showMore();
      return;
    }
    if (t.closest("[data-ws-clear]")) {
      this.clearFilters();
      return;
    }
    if (t.closest("[data-ws-loop]")) {
      this.setLoop(!this.loop);
      return;
    }
    const wave = t.closest(".ws-wave");
    if (wave) {
      if (this._lastPointer === "touch") this._seekAt(wave, e.clientX);
      return;
    }
    const row = t.closest("[data-ws-index]");
    if (!row || t.closest(".ws-download")) return;
    this.toggle(Number(row.dataset.wsIndex));
    this._focusRowQuietly(row);
  }
  /**
   * Mouse and pen seek on PRESS, like every scrubber. Remembers the
   * pointer type for the click that follows.
   * @private
   */
  _onPointerDown(e) {
    this._lastPointer = e.pointerType;
    const wave = e.target.closest(".ws-wave");
    if (!wave || e.button !== 0 || e.pointerType === "touch") return;
    e.preventDefault();
    this._seekAt(wave, e.clientX);
  }
  /**
   * Seek (or start) a row's sound where its waveform was pressed.
   * @private
   */
  _seekAt(wave, clientX) {
    const row = wave.closest("[data-ws-index]");
    this._seekRow(Number(row.dataset.wsIndex), pointerFraction(clientX, wave.getBoundingClientRect()));
    this._focusRowQuietly(row);
  }
  /**
   * Keys on the list: `/` focuses search; ↑/↓/Home/End move between rows
   * (auditioning while something plays); ←/→ seek the playing row.
   * @private
   */
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
    const seek = seekTarget(this.progress, e.key);
    if (seek !== null) {
      if (index !== this.currentIndex || !this.engine) return;
      e.preventDefault();
      this._seekRow(index, seek);
      return;
    }
    const rows = visibleRows(this.$.list);
    const target = rowTarget(e.key, rows.indexOf(row), rows.length);
    if (target === null) return;
    e.preventDefault();
    if (target === "search") {
      this.$.search?.focus();
      return;
    }
    this._focusRow(rows[target]);
    if (this.options.arrowAudition && this.playing) this.play(Number(rows[target].dataset.wsIndex));
  }
  /**
   * Focus a row's play button.
   * @private
   */
  _focusRow(row) {
    row?.querySelector(".ws-play")?.focus();
  }
  /**
   * After a mouse or touch play, put focus on that row's play button so
   * the arrow keys drive the list instead of scrolling the page (a click
   * on the title or waveform left focus on <body>, and Safari never
   * focuses a clicked button). No scroll jump, and no focus ring: the
   * browser shows none for a focus that follows a pointer.
   * @private
   */
  _focusRowQuietly(row) {
    const btn = row?.querySelector(".ws-play");
    if (btn && document.activeElement !== btn) btn.focus({ preventScroll: true });
  }
  /* ── Drawing & colours ────────────────────────────────────────────── */
  /**
   * Draw row canvases as they scroll into view; redraw on resize and on
   * theme flips (the canvas can't follow CSS by itself).
   * @private
   */
  _observe() {
    if (this.render.player !== "inline" || typeof window === "undefined") return;
    this._drawn = /* @__PURE__ */ new Set();
    if ("IntersectionObserver" in window) {
      this._io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number(entry.target.dataset.wsIndex);
          this._drawn.add(i);
          this._drawRow(i);
        }
      }, { rootMargin: "200px 0px" });
      this.rows.forEach((r) => r && this._io.observe(r));
    } else {
      this.rows.forEach((r, i) => r && this._drawn.add(i));
    }
    if ("ResizeObserver" in window) {
      let width = 0;
      this._ro = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (w === width) return;
        width = w;
        this._redrawAll();
      });
      this._ro.observe(this.$.list);
    }
    const refresh = () => requestAnimationFrame(() => {
      this._resolveColors();
      this._redrawAll();
    });
    this._mo = new MutationObserver(refresh);
    const watch = { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme", "style"] };
    this._mo.observe(document.documentElement, watch);
    if (document.body) this._mo.observe(document.body, watch);
    try {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refresh, { signal: this._ctl.signal });
    } catch {
    }
  }
  /**
   * Resolve the canvas colours (options, else the CSS custom properties)
   * and keep `--ws-surface` current unless the site set it.
   * @private
   */
  _resolveColors() {
    if (this._autoSurface || !getComputedStyle(this.container).getPropertyValue("--ws-surface").trim()) {
      this._autoSurface = true;
      this.container.style.removeProperty("--ws-surface");
      this.container.style.setProperty("--ws-surface", pageSurface(this.container));
    }
    this.colors = {
      wave: this.options.waveformColor || resolveCssColor(this.container, "var(--ws-wave-color)") || "rgba(128,128,128,.5)",
      progress: this.options.progressColor || resolveCssColor(this.container, "var(--ws-progress-color)") || "currentColor"
    };
  }
  /**
   * Draw one row's waveform (only once it has been on screen).
   * @private
   */
  _drawRow(index) {
    if (this.render.player !== "inline" || index == null || !this._drawn?.has(index)) return;
    const row = this.rows[index];
    const canvas = row?.querySelector("canvas");
    if (!canvas || row.hidden) return;
    const gap = Number(this.options.barGap);
    drawRowWaveform(canvas, this.sounds[index].peaks, index === this.currentIndex ? this.progress : 0, {
      style: this.options.waveformStyle,
      color: this.colors?.wave || "rgba(128,128,128,.5)",
      progressColor: this.colors?.progress || "currentColor",
      barWidth: Math.max(1, Number(this.options.barWidth) || 2),
      barGap: Number.isFinite(gap) ? Math.max(0, gap) : 1
    });
  }
  /**
   * Redraw every row drawn so far.
   * @private
   */
  _redrawAll() {
    this._drawn?.forEach((i) => this._drawRow(i));
  }
  /* ── Filters in the address ───────────────────────────────────────── */
  /**
   * Apply the filter and sort from the address (`urlState`).
   * @private
   */
  _readUrl() {
    const keys = urlKeys(this.options.urlState);
    if (!keys || typeof location === "undefined") return;
    const { filter, sort } = readUrlState(location.search, keys, facets(this.sounds), this._sorts);
    this.filter = { ...this.filter, ...filter };
    if (sort) {
      this.sortBy = sort;
      this._sortSet = true;
    }
  }
  /**
   * Rewrite the address shortly after a change (replaceState: no history
   * entries).
   * @private
   */
  _queueUrl() {
    const keys = urlKeys(this.options.urlState);
    if (!keys || typeof location === "undefined") return;
    clearTimeout(this._urlTimer);
    this._urlTimer = setTimeout(() => {
      if (this.destroyed) return;
      const next = writeUrlState(location.href, keys, this.filter, this.sortBy, this._sorts?.[0] || "default");
      if (next !== location.href) history.replaceState(history.state, "", next);
    }, URL_DELAY);
  }
  /* ── Filtering, sorting, paging ───────────────────────────────────── */
  /** The sounds that pass the filter, in the current sort order. */
  get visible() {
    return sortSounds(this.sounds.filter((s) => matches(s, this.filter)), this.sortBy);
  }
  /**
   * Change the filter (merged into the current one) and re-apply. Back to
   * the first page.
   *
   * @param {Partial<import('../../../index').SoundsFilter>} patch
   */
  setFilter(patch = {}) {
    this.filter = { ...this.filter, ...patch };
    this.limit = this._pageSize();
    this._syncControls();
    this._apply({ resort: false });
  }
  /** Reset every filter (the sort stays). */
  clearFilters() {
    this.setFilter(NO_FILTER);
  }
  /** @param {import('../../../index').SoundsSort} by */
  setSort(by) {
    this._sortSet = true;
    this.sortBy = SORTS.includes(by) ? by : "default";
    this.menus?.setValue("sort", this.sortBy);
    this._apply({ resort: true });
  }
  /** Reveal the next page of results. */
  showMore() {
    if (this.limit === Infinity) return;
    this.limit += this.render.pageSize;
    this._apply({ resort: false });
  }
  /**
   * Rows per page (Infinity when paging is off).
   * @private
   */
  _pageSize() {
    return this.render.pageSize > 0 ? this.render.pageSize : Infinity;
  }
  /**
   * Show the current filter and sort in the controls (they can be set from
   * code or the address, not only by the controls themselves).
   * @private
   */
  _syncControls() {
    const $ = this.$, f = this.filter;
    if (!$) return;
    if ($.search && $.search.value !== f.query) $.search.value = f.query;
    this.menus?.setValue("type", f.type || "");
    this.menus?.setValue("key", f.key || "");
    this.menus?.setValue("sort", this.sortBy);
    if ($.bpmMin && $.bpmMin.value !== String(f.bpmMin)) $.bpmMin.value = f.bpmMin;
    if ($.bpmMax && $.bpmMax.value !== String(f.bpmMax)) $.bpmMax.value = f.bpmMax;
    $.chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.wsType === (f.type || ""))));
  }
  /**
   * Lay the rows out for the current filter, sort and page: order, hide,
   * "Show more", the empty state and the count. Then report it.
   *
   * @param {{resort: boolean}} opts - Reorder the rows even if the sort
   *   hasn't changed.
   * @private
   */
  _apply({ resort }) {
    const $ = this.$;
    if (!$) return;
    if (resort || this.sortBy !== this._lastSort) {
      orderRows($.list, sortSounds(this.sounds, this.sortBy).map((s) => this.rows[this.sounds.indexOf(s)]));
      this._lastSort = this.sortBy;
    }
    const shown = this.visible;
    const { visible, remaining } = pageWindow(shown, this.limit);
    this.sounds.forEach((s, i) => {
      if (this.rows[i]) this.rows[i].hidden = !visible.has(s);
    });
    if ($.more) {
      $.more.hidden = remaining <= 0;
      $.more.textContent = fill(this.strings.showMore, { count: Math.min(remaining, this.render.pageSize || remaining) });
    }
    if ($.empty) $.empty.hidden = shown.length > 0;
    if ($.count) $.count.textContent = countText(shown.length, this.sounds.length, this.strings);
    this._queueUrl();
    this._emit("filter", { visible: shown.length, total: this.sounds.length, filter: { ...this.filter }, sort: this.sortBy });
    this.options.onFilter?.(shown, this);
  }
  /* ── Playback ─────────────────────────────────────────────────────── */
  /**
   * Resolve an index, id or sound to an index in `this.sounds`. No
   * target means the current sound, else the first visible one.
   *
   * @param {number|string|Object} [target]
   * @returns {number|null}
   * @private
   */
  _indexOf(target) {
    if (target == null) return this.currentIndex ?? (this.visible[0] ? this.sounds.indexOf(this.visible[0]) : null);
    if (typeof target === "number") return this.sounds[target] ? target : null;
    const i = typeof target === "object" ? this.sounds.indexOf(target) : this.sounds.findIndex((s) => s.id === String(target));
    return i >= 0 ? i : null;
  }
  /**
   * The WaveformPlayer class: `playerClass`, else the page's global.
   * @returns {Function|null}
   * @private
   */
  _playerClass() {
    return this.options.playerClass || (typeof window !== "undefined" ? window.WaveformPlayer : null) || null;
  }
  /**
   * Build the engine once (it holds no audio until a play).
   * @returns {Object|null} The engine, or null without a player class.
   * @private
   */
  _ensureEngine() {
    if (this.engine) return this.engine;
    const Player = this._playerClass();
    if (!Player) {
      console.error(`${LOG} @arraypress/waveform-player is required: load it before playing (or pass playerClass).`);
      return null;
    }
    this.engine = new Player(this.$.engine, engineOptions(this.options.playerOptions, this.render.player, {
      onLoad: () => this._onEngineLoad(),
      onPlay: () => this._setPlaying(true),
      onPause: () => this._setPlaying(false),
      onEnd: () => this._onEnd(),
      onTimeUpdate: (time, duration) => this._onTime(time, duration),
      onError: (err) => this._onEngineError(err)
    }));
    return this.engine;
  }
  /**
   * Play a sound (by index, id or sound object), or resume the current
   * one. Before the list is built the call waits for it.
   *
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
    if (index === this.currentIndex && engine.audio?.src) {
      if (opts.at != null) this._seekRow(index, opts.at);
      if (!this.playing) engine.play();
      return;
    }
    const previous = this.currentIndex;
    this.currentIndex = index;
    this.progress = 0;
    this._pendingSeek = opts.at ?? null;
    if (previous != null) this._paintRow(previous);
    this._paintRow(index);
    const sound = this.sounds[index];
    engine.loadTrack(sound.url, sound.title, sound.type || null, { waveform: enginePeaks(sound, this.render.player), autoplay: true });
  }
  /** Pause the current sound. */
  pause() {
    if (this.engine && this.playing) this.engine.pause();
  }
  /**
   * The current sound plays/pauses; another sound starts.
   * @param {number|string|Object} [target]
   */
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
  /**
   * Play the visible sound `dir` places away, revealing it if it's past
   * the current page.
   *
   * @param {1|-1} dir
   * @returns {boolean} Whether there was one.
   * @private
   */
  _step(dir) {
    const shown = this.visible;
    const at = this.currentIndex == null ? -1 : shown.indexOf(this.sounds[this.currentIndex]);
    const target = shown[at + dir];
    if (!target) return false;
    const limit = limitToReveal(this.limit, at + dir);
    if (limit !== this.limit) {
      this.limit = limit;
      this._apply({ resort: false });
    }
    this.play(this.sounds.indexOf(target));
    return true;
  }
  /**
   * Loop the current sound (auditioning a loop is the common case).
   * @param {boolean} on
   */
  setLoop(on) {
    this.loop = !!on;
    this._setLoop(this.loop);
  }
  /**
   * Apply the loop state to the toggle and the engine.
   * @private
   */
  _setLoop(on) {
    this.$?.loop?.setAttribute("aria-pressed", String(on));
    if (this.engine?.audio) this.engine.audio.loop = on;
  }
  /**
   * Seek a row's sound to `fraction`; a row that isn't current starts
   * there. Before the duration is known the seek waits for it.
   * @private
   */
  _seekRow(index, fraction) {
    if (index !== this.currentIndex || !this.engine) {
      this.play(index, { at: fraction });
      return;
    }
    const duration = this.engine.audio?.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      this._pendingSeek = fraction;
      return;
    }
    this.engine.seekTo(fraction * duration);
    this.progress = fraction;
    this._paintRow(index);
    if (!this.playing) this.engine.play();
  }
  /**
   * The engine loaded a sound: apply the loop, borrow decoded peaks for a
   * row that had none, and land a pending seek.
   * @private
   */
  _onEngineLoad() {
    if (this.engine?.audio) this.engine.audio.loop = this.loop;
    const sound = this.sounds[this.currentIndex];
    if (sound && !sound.peaks && this.engine?.waveformData?.length) {
      sound.peaks = resample(this.engine.waveformData, 96);
      this._drawRow(this.currentIndex);
    }
    const duration = this.engine?.audio?.duration;
    if (this._pendingSeek != null && Number.isFinite(duration) && duration > 0) {
      this.engine.seekTo(this._pendingSeek * duration);
      this.progress = this._pendingSeek;
      this._pendingSeek = null;
    }
  }
  /**
   * Playback progress: repaint the current row, once per frame.
   * @private
   */
  _onTime(time, duration) {
    if (this.currentIndex == null || !duration) return;
    if (this._pendingSeek != null) {
      const fraction = this._pendingSeek;
      this._pendingSeek = null;
      this.engine.seekTo(fraction * duration);
      return;
    }
    this.progress = Math.min(Math.max(time / duration, 0), 1);
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._drawRow(this.currentIndex);
      this.rows[this.currentIndex]?.querySelector(".ws-wave")?.setAttribute("aria-valuenow", String(Math.round(this.progress * 100)));
    });
  }
  /**
   * A sound finished: report it, then auto-advance or settle.
   * @private
   */
  _onEnd() {
    const sound = this.sounds[this.currentIndex];
    this._emit("end", { sound, index: this.currentIndex });
    this.options.onEnd?.(sound, this);
    if (this.options.autoAdvance && this._step(1)) return;
    this.progress = 0;
    this._setPlaying(false);
  }
  /**
   * A sound failed to load or play: mark its row and report it.
   * @private
   */
  _onEngineError(err) {
    this.rows[this.currentIndex]?.classList.add("is-error");
    this._emit("error", { error: err, sound: this.sounds[this.currentIndex], index: this.currentIndex });
    this.options.onError?.(err, this);
  }
  /**
   * Record play/pause and repaint. Events fire only on a real change: at a
   * natural end the browser fires `pause` then `ended`, and `_onEnd()`
   * also settles the state — one pause event, not two.
   * @private
   */
  _setPlaying(on) {
    const changed = this.playing !== on;
    this.playing = on;
    const index = this.currentIndex;
    if (index == null) return;
    this._paintRow(index);
    if (!changed) return;
    const sound = this.sounds[index];
    if (on && this.$.status) this.$.status.textContent = fill(this.strings.nowPlaying, { title: sound.title });
    this._emit(on ? "play" : "pause", { sound, index });
    (on ? this.options.onPlay : this.options.onPause)?.(sound, this);
  }
  /* ── Row painting ─────────────────────────────────────────────────── */
  /**
   * A row's state classes, play-button label and waveform.
   * @private
   */
  _paintRow(index) {
    const row = this.rows[index];
    if (!row) return;
    const current = index === this.currentIndex;
    const on = current && this.playing;
    row.classList.toggle("is-current", current);
    row.classList.toggle("is-playing", on);
    const btn = row.querySelector(".ws-play");
    if (btn) {
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", fill(on ? this.strings.pause : this.strings.play, { title: this.sounds[index].title }));
    }
    const wave = row.querySelector(".ws-wave");
    if (wave) {
      wave.tabIndex = current ? 0 : -1;
      if (!current) wave.setAttribute("aria-valuenow", "0");
    }
    this._drawRow(index);
  }
  /* ── Events & lifecycle ──────────────────────────────────────────── */
  /**
   * Emit a `waveformsounds:<name>` event carrying this instance.
   * @private
   */
  _emit(name, detail = {}) {
    emit(this.container, name, { ...detail, instance: this });
  }
  /** The sound playing (or paused) now, or null. */
  get current() {
    return this.currentIndex == null ? null : this.sounds[this.currentIndex];
  }
  /**
   * Tear down: listeners, observers, timers and the engine. Markup this
   * instance rendered is restored to what the container held before.
   * ADOPTED (server-rendered) markup is left as it is now — rows may be
   * re-sorted, hidden or marked current — so to start again, re-render it
   * rather than constructing a new instance over it.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._ctl.abort();
    this._io?.disconnect();
    this._ro?.disconnect();
    this._mo?.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
    clearTimeout(this._urlTimer);
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
   *
   * @param {ParentNode} [root=document]
   * @returns {WaveformSounds[]} The new instances.
   */
  static init(root = document) {
    if (typeof document === "undefined") return [];
    const scope = root || document;
    const els = [...scope.matches?.("[data-waveform-sounds]") ? [scope] : [], ...scope.querySelectorAll("[data-waveform-sounds]")];
    const created = [];
    for (const el of els) {
      if (el.dataset.wsInitialized === "true" || _WaveformSounds.instances.has(el)) continue;
      try {
        created.push(new _WaveformSounds(el));
      } catch (err) {
        console.error(`${LOG} Failed to initialise:`, err, el);
      }
    }
    return created;
  }
  /**
   * The instance on an element (or selector), if any.
   * @param {Element|string} el
   * @returns {WaveformSounds|null}
   */
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
