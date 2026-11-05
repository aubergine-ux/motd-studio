// The &-code textarea and its formatting toolbar.
import { LEGACY_COLORS, FORMATS, styleAtEnd, restoreCodes } from './mc-text.js';

const MAX_LINES = 2;
const FORMAT_BUTTONS = [
  { code: 'l', label: 'B', name: 'Bold', key: 'b' },
  { code: 'o', label: 'I', name: 'Italic', key: 'i' },
  { code: 'n', label: 'U', name: 'Underline', key: 'u' },
  { code: 'm', label: 'S', name: 'Strikethrough' },
  { code: 'k', label: '?!', name: 'Obfuscated' },
  { code: 'r', label: 'R', name: 'Reset' },
];
const titleCase = (s) => s.replace(/(^|_)(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

export function createEditor({ textarea, toolbar, onChange }) {
  const swatches = el('div', { className: 'swatches', role: 'group' });
  swatches.setAttribute('aria-label', 'Colors');
  LEGACY_COLORS.forEach((c, i) => {
    const b = el('button', { type: 'button', className: 'swatch', title: `${titleCase(c.name)} (&${c.code})` });
    b.style.setProperty('--swatch', c.hex);
    b.dataset.code = '&' + c.code;
    b.tabIndex = i === 0 ? 0 : -1;
    b.setAttribute('aria-label', `${titleCase(c.name)}, code &${c.code}`);
    swatches.append(b);
  });

  const formats = el('div', { className: 'formats', role: 'group' });
  formats.setAttribute('aria-label', 'Formatting');
  for (const f of FORMAT_BUTTONS) {
    const shortcut = f.key ? ` (Ctrl+${f.key.toUpperCase()})` : '';
    const b = el('button', { type: 'button', className: `fmt fmt-${f.code}`, textContent: f.label,
      title: `${f.name} &${f.code}${shortcut}` });
    b.dataset.code = '&' + f.code;
    b.setAttribute('aria-label', `${f.name}, code &${f.code}`);
    formats.append(b);
  }

  const hexLabel = el('label', { className: 'hex-pick', title: 'Hex color (&#rrggbb)' });
  const hexInput = el('input', { type: 'color', value: '#c084fc' });
  hexLabel.append(hexInput, el('span', { textContent: 'Hex' }));
  hexInput.setAttribute('aria-label', 'Hex color');
  toolbar.append(swatches, formats, hexLabel);

  const emit = () => onChange(textarea.value);

  /** Replace a range while keeping the browser's undo history where possible. */
  function replaceRange(start, end, text) {
    textarea.focus();
    textarea.setSelectionRange(start, end);
    if (!document.execCommand?.('insertText', false, text)) {
      textarea.setRangeText(text, start, end, 'end');
      emit();
    }
  }

  /** Apply a code to the selection, restoring the previous style after it. */
  function apply(code) {
    const { selectionStart: s, selectionEnd: e, value } = textarea;
    const selected = value.slice(s, e);
    const after = value.slice(e);
    const isColor = /^&([0-9a-f]|#)/i.test(code);
    let insert = code;
    // Colors wipe formatting, so carry over the formats already active here.
    if (isColor) {
      const here = styleAtEnd(value.slice(0, s));
      insert = code + FORMATS.filter((f) => here[f.key]).map((f) => '&' + f.code).join('');
    }
    let tail = '';
    if (selected && after && code !== '&r' && !/^&([0-9a-fr#x])/i.test(after)) {
      tail = restoreCodes(styleAtEnd(value.slice(0, e)));
    }
    replaceRange(s, e, insert + selected + tail);
    textarea.setSelectionRange(s + insert.length, s + insert.length + selected.length);
  }

  toolbar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-code]');
    if (btn) apply(btn.dataset.code);
  });
  hexInput.addEventListener('change', () => apply('&' + hexInput.value.toLowerCase()));

  // Roving focus: one tab stop for the swatch grid, arrows move within it.
  swatches.addEventListener('keydown', (ev) => {
    const list = [...swatches.children];
    const i = list.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowDown: 8, ArrowLeft: -1, ArrowUp: -8, Home: -i, End: list.length - 1 - i }[ev.key];
    if (i < 0 || step === undefined) return;
    ev.preventDefault();
    const next = list[(i + step + list.length) % list.length];
    list.forEach((b) => { b.tabIndex = b === next ? 0 : -1; });
    next.focus();
  });

  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && textarea.value.split('\n').length >= MAX_LINES) {
      ev.preventDefault();
      textarea.classList.remove('nudge');
      void textarea.offsetWidth;
      textarea.classList.add('nudge');
      return;
    }
    const f = FORMAT_BUTTONS.find((b) => b.key && b.key === ev.key.toLowerCase());
    if (f && (ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey) {
      ev.preventDefault();
      apply('&' + f.code);
    }
  });

  textarea.addEventListener('input', () => {
    const lines = textarea.value.split('\n');
    if (lines.length > MAX_LINES) {
      const pos = textarea.selectionStart;
      textarea.value = lines[0] + '\n' + lines.slice(1).join(' ');
      textarea.setSelectionRange(pos, pos);
    }
    emit();
  });

  return {
    get value() { return textarea.value; },
    /** Replace everything; undoable with Ctrl+Z when the browser allows it. */
    set(value) {
      const back = document.activeElement;
      replaceRange(0, textarea.value.length, value);
      textarea.setSelectionRange(0, 0);
      textarea.scrollLeft = 0;
      back?.focus?.();
    },
    load(value) { textarea.value = value; },
  };
}
