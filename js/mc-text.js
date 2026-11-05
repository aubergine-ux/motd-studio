// mc-text — a DOM-free model of Minecraft formatted text.
//
// Every format is parsed into, and serialized from, one segment model:
//   { text, color, bold, italic, underlined, strikethrough, obfuscated }
// `color` is null (inherit the default), a legacy color name ("gold"),
// or a lowercase hex string ("#ffaa00").

export const LEGACY_COLORS = [
  ['0', 'black', '#000000'], ['1', 'dark_blue', '#0000aa'],
  ['2', 'dark_green', '#00aa00'], ['3', 'dark_aqua', '#00aaaa'],
  ['4', 'dark_red', '#aa0000'], ['5', 'dark_purple', '#aa00aa'],
  ['6', 'gold', '#ffaa00'], ['7', 'gray', '#aaaaaa'],
  ['8', 'dark_gray', '#555555'], ['9', 'blue', '#5555ff'],
  ['a', 'green', '#55ff55'], ['b', 'aqua', '#55ffff'],
  ['c', 'red', '#ff5555'], ['d', 'light_purple', '#ff55ff'],
  ['e', 'yellow', '#ffff55'], ['f', 'white', '#ffffff'],
].map(([code, name, hex]) => ({ code, name, hex }));

export const FORMATS = [
  { code: 'l', key: 'bold' },
  { code: 'o', key: 'italic' },
  { code: 'n', key: 'underlined' },
  { code: 'm', key: 'strikethrough' },
  { code: 'k', key: 'obfuscated' },
];

const FLAG_KEYS = FORMATS.map((f) => f.key);
const BY_CODE = new Map(LEGACY_COLORS.map((c) => [c.code, c]));
const BY_NAME = new Map(LEGACY_COLORS.map((c) => [c.name, c]));
const BY_HEX = new Map(LEGACY_COLORS.map((c) => [c.hex, c]));
const FORMAT_BY_CODE = new Map(FORMATS.map((f) => [f.code, f.key]));
const HEX6 = /^#?([0-9a-f]{6})$/i;

export const plainStyle = () => ({
  color: null, bold: false, italic: false,
  underlined: false, strikethrough: false, obfuscated: false,
});

const sameStyle = (a, b) =>
  a.color === b.color && FLAG_KEYS.every((k) => !!a[k] === !!b[k]);

const pickStyle = (s) => {
  const out = { color: s.color ?? null };
  for (const k of FLAG_KEYS) out[k] = !!s[k];
  return out;
};

/** Normalize a color value: legacy names stay names, hex that exactly
 *  matches a legacy color becomes its name, anything else is lowercase hex. */
export function normalizeColor(value) {
  if (value == null || value === '') return null;
  const v = String(value).toLowerCase().trim();
  const alias = v.replace('grey', 'gray');
  if (BY_NAME.has(alias)) return alias;
  const m = HEX6.exec(v);
  if (!m) return null;
  const hex = '#' + m[1];
  return BY_HEX.get(hex)?.name ?? hex;
}

/** Resolve any color value to "#rrggbb" (null stays null). */
export function colorToHex(color) {
  if (color == null) return null;
  return BY_NAME.get(color)?.hex ?? color;
}

export const isHexColor = (color) => color != null && !BY_NAME.has(color);

/** Find the legacy color closest to a hex value (weighted "redmean" distance). */
export function nearestLegacy(hex) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = rgb(colorToHex(hex));
  let best = null;
  let bestDist = Infinity;
  for (const c of LEGACY_COLORS) {
    const [r2, g2, b2] = rgb(c.hex);
    const rm = (r1 + r2) / 2;
    const d = (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best.name;
}

/** Merge adjacent same-style segments and drop empty ones. */
export function normalize(segments) {
  const out = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const prev = out[out.length - 1];
    if (prev && sameStyle(prev, seg)) prev.text += seg.text;
    else out.push({ text: seg.text, ...pickStyle(seg) });
  }
  return out;
}

export const hasHex = (segments) => segments.some((s) => isHexColor(s.color));
export const toPlain = (segments) => segments.map((s) => s.text).join('');

/** Split segments into lines on "\n" (styles carry across lines). */
export function splitLines(segments) {
  const lines = [[]];
  for (const seg of segments) {
    seg.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...seg, text: part });
    });
  }
  return lines;
}

// ---------------------------------------------------------------- legacy

/**
 * Parse legacy codes. `prefix` is "§" or "&". Supports 0-9a-f, k-o, r,
 * the "§x§r§r§g§g§b§b" hex form and the "&#rrggbb" shorthand.
 *
 * Java Edition quirk: a color code resets every active format, so
 * "&l&6Hi" is gold but NOT bold, while "&6&lHi" is gold and bold.
 */
export function parseLegacy(input, prefix = '&', base = plainStyle()) {
  const segments = [];
  let style = pickStyle(base);
  let buf = '';
  const flush = () => { if (buf) segments.push({ text: buf, ...style }); buf = ''; };
  const setColor = (color) => { flush(); style = { ...plainStyle(), color }; };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch !== prefix || i + 1 >= input.length) { buf += ch; continue; }
    const code = input[i + 1].toLowerCase();
    if (BY_CODE.has(code)) { setColor(BY_CODE.get(code).name); i++; continue; }
    if (FORMAT_BY_CODE.has(code)) { flush(); style[FORMAT_BY_CODE.get(code)] = true; i++; continue; }
    if (code === 'r') { flush(); style = pickStyle(base); i++; continue; }
    if (code === '#') {
      const m = /^[0-9a-f]{6}/i.exec(input.slice(i + 2));
      if (m) { setColor(normalizeColor(m[0])); i += 7; continue; }
    }
    if (code === 'x') {
      const run = input.slice(i + 2, i + 14);
      const digits = run.split(prefix).join('');
      if (run.length === 12 && digits.length === 6 && /^[0-9a-f]{6}$/i.test(digits)
          && [...run].every((c, j) => (j % 2 === 0) === (c === prefix))) {
        setColor(normalizeColor(digits)); i += 13; continue;
      }
    }
    buf += ch;
  }
  flush();
  return normalize(segments);
}

/** Codes that turn a fresh (reset) state into `style`. */
function codesFor(style, prefix, hexMode) {
  let out = '';
  if (style.color) {
    let color = style.color;
    if (isHexColor(color) && hexMode === 'none') color = nearestLegacy(color);
    if (!isHexColor(color)) out += prefix + BY_NAME.get(color).code;
    else if (hexMode === 'x') out += prefix + 'x' + [...color.slice(1)].map((c) => prefix + c).join('');
    else out += prefix + color;
  }
  for (const f of FORMATS) if (style[f.key]) out += prefix + f.code;
  return out;
}

/**
 * Serialize segments to legacy codes using the fewest codes the
 * color-resets-formatting rule allows.
 * hexMode: "none" (fall back to nearest legacy), "hash" (&#rrggbb), "x" (§x§r…).
 */
export function serializeLegacy(segments, prefix = '&', hexMode = 'none') {
  let cur = plainStyle();
  let out = '';
  for (const seg of normalize(segments)) {
    const next = pickStyle(seg);
    if (hexMode === 'none' && isHexColor(next.color)) next.color = nearestLegacy(next.color);
    const dropsFlag = FLAG_KEYS.some((k) => cur[k] && !next[k]);
    if (next.color !== cur.color || dropsFlag) {
      out += (next.color ? '' : prefix + 'r') + codesFor(next, prefix, hexMode);
    } else {
      for (const f of FORMATS) if (next[f.key] && !cur[f.key]) out += prefix + f.code;
    }
    out += seg.text;
    cur = next;
  }
  return out;
}

/** Codes needed to switch from any state back to `style` (used by the editor). */
export const restoreCodes = (style, prefix = '&') =>
  (style.color ? '' : prefix + 'r') + codesFor(style, prefix, 'hash');

/** The style active at the end of a legacy string. */
export function styleAtEnd(input, prefix = '&') {
  const segs = parseLegacy(input + '\u0000', prefix);
  return pickStyle(segs[segs.length - 1]);
}

// ------------------------------------------------------ server.properties

export function toServerProperties(segments) {
  const value = serializeLegacy(segments, '§', 'none')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'))
    .replace(/^ /, '\\ ');
  return 'motd=' + value;
}

export function parseServerProperties(line) {
  const value = line.trim().replace(/^motd\s*[=:]\s*/, '');
  const text = value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, e) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', f: '\f' }[e] ?? e;
  });
  return parseLegacy(text, '§');
}

// ---------------------------------------------------------- JSON text

/** Parse a JSON text component (string, array or object; `extra` inherits style). */
export function parseJson(input) {
  let root = typeof input === 'string' ? JSON.parse(input) : input;
  if (root && typeof root === 'object' && !Array.isArray(root) && 'description' in root) root = root.description;
  const out = [];
  const walk = (node, parent) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      if (!node.length) return;
      const [first, ...rest] = node;
      const head = first && typeof first === 'object' && !Array.isArray(first) ? first : { text: '', extra: [first] };
      walk({ ...head, extra: [...(head.extra ?? []), ...rest] }, parent);
      return;
    }
    if (typeof node !== 'object') { out.push(...parseLegacy(String(node), '§', parent)); return; }
    const style = { ...parent };
    if ('color' in node) style.color = normalizeColor(node.color);
    for (const k of FLAG_KEYS) if (k in node) style[k] = !!node[k];
    const text = node.text ?? node.translate ?? '';
    out.push(...parseLegacy(String(text), '§', style));
    for (const child of node.extra ?? []) walk(child, style);
  };
  walk(root, plainStyle());
  return normalize(out);
}

export function serializeJson(segments) {
  const parts = normalize(segments).map((seg) => {
    const obj = { text: seg.text };
    if (seg.color) obj.color = isHexColor(seg.color) ? seg.color.toUpperCase() : seg.color;
    for (const k of FLAG_KEYS) if (seg[k]) obj[k] = true;
    return Object.keys(obj).length === 1 ? seg.text : obj;
  });
  if (parts.length === 0) return JSON.stringify({ text: '' });
  if (parts.length === 1) return JSON.stringify(typeof parts[0] === 'string' ? { text: parts[0] } : parts[0]);
  return JSON.stringify({ text: '', extra: parts });
}

// --------------------------------------------------------- MiniMessage

const MM_FLAGS = {
  bold: 'bold', b: 'bold', italic: 'italic', i: 'italic', em: 'italic',
  underlined: 'underlined', u: 'underlined', strikethrough: 'strikethrough',
  st: 'strikethrough', obfuscated: 'obfuscated', obf: 'obfuscated',
};
const MM_IGNORED = new Set(['gradient', 'rainbow', 'transition', 'hover', 'click', 'insert',
  'insertion', 'font', 'shadow', 'pride', 'key', 'lang', 'tr', 'translate']);
const MM_TAG = /<(\/?)(!?)([a-z0-9_#]+)((?::[^<>]*)?)>/iy;

/** Read a MiniMessage tag at `i`; returns null if it isn't one we recognize. */
function readMiniTag(input, i) {
  MM_TAG.lastIndex = i;
  const m = MM_TAG.exec(input);
  if (!m) return null;
  const [raw, close, negate, rawName, rawArgs] = m;
  let name = rawName.toLowerCase();
  const arg = rawArgs.slice(1).split(':')[0].replace(/^['"]|['"]$/g, '');
  const tag = { raw, close: !!close, name, apply: null };
  if (name === 'newline' || name === 'br') tag.newline = true;
  else if (name === 'reset') tag.reset = true;
  else if (MM_FLAGS[name]) { const k = MM_FLAGS[name]; tag.name = k; tag.apply = (s) => { s[k] = !negate; }; }
  else if (MM_IGNORED.has(name)) tag.apply = () => {};
  else {
    const colorWord = ['color', 'colour', 'c'].includes(name);
    const color = normalizeColor(colorWord ? arg : name);
    if (!color && !(close && colorWord)) return null;
    tag.name = 'color';
    tag.apply = (s) => { s.color = color; };
  }
  if (close && !tag.apply) return null;
  return tag;
}

export function parseMiniMessage(input) {
  const out = [];
  let stack = [];
  let buf = '';
  const current = () => { const s = plainStyle(); for (const t of stack) t.apply(s); return s; };
  const flush = () => { if (buf) out.push({ text: buf, ...current() }); buf = ''; };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\' && (input[i + 1] === '<' || input[i + 1] === '\\')) { buf += input[++i]; continue; }
    if (ch !== '<') { buf += ch; continue; }
    const tag = readMiniTag(input, i);
    if (!tag) { buf += ch; continue; }
    flush();
    i += tag.raw.length - 1;
    if (tag.newline) buf += '\n';
    else if (tag.reset) stack = [];
    else if (tag.close) {
      const idx = stack.map((t) => t.name).lastIndexOf(tag.name);
      if (idx >= 0) stack = stack.slice(0, idx);
    } else stack.push(tag);
  }
  flush();
  return normalize(out);
}

const escapeMini = (text) => text.replace(/\\/g, '\\\\').replace(/</g, '\\<');

/** Serialize to MiniMessage, nesting tags and closing only what changes. */
export function serializeMiniMessage(segments) {
  const tagFor = (key, value) => (key === 'color' ? `<${value}>` : `<${key}>`);
  const closeFor = (key, value) => (key === 'color' ? `</${value}>` : `</${key}>`);
  let open = [];
  let out = '';
  for (const seg of normalize(segments)) {
    const wanted = [];
    if (seg.color) wanted.push(['color', seg.color]);
    for (const k of FLAG_KEYS) if (seg[k]) wanted.push([k, true]);
    let keep = 0;
    while (keep < open.length && wanted.some(([k, v]) => k === open[keep][0] && v === open[keep][1])) keep++;
    for (let j = open.length - 1; j >= keep; j--) out += closeFor(...open[j]);
    open = open.slice(0, keep);
    for (const w of wanted) {
      if (open.some(([k]) => k === w[0])) continue;
      out += tagFor(...w);
      open.push(w);
    }
    out += seg.text.split('\n').map(escapeMini).join('<newline>');
  }
  return out;
}

// ------------------------------------------------------------- detect

/** Guess the format of pasted text and parse it. */
export function parseAny(input) {
  const text = input.replace(/\r\n?/g, '\n');
  const trimmed = text.trim();
  if (/^motd\s*[=:]/.test(trimmed) || /\\u00a7/i.test(trimmed)) {
    return { format: 'properties', segments: parseServerProperties(trimmed) };
  }
  if (/^[[{"]/.test(trimmed)) {
    try { return { format: 'json', segments: parseJson(trimmed) }; } catch { /* not JSON */ }
  }
  for (let i = text.indexOf('<'); i >= 0; i = text.indexOf('<', i + 1)) {
    if (readMiniTag(text, i)) return { format: 'minimessage', segments: parseMiniMessage(text) };
  }
  if (text.includes('§')) return { format: 'section', segments: parseLegacy(text, '§') };
  return { format: 'ampersand', segments: parseLegacy(text, '&') };
}
