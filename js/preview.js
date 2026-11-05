// Renders segments into the server-list row and keeps the width meters current.
import { splitLines, colorToHex, toPlain } from './mc-text.js';

/** Visible MOTD width in GUI pixels (row width minus the icon). Tune it here. */
export const MOTD_WIDTH = 270;
const ROW_WIDTH = MOTD_WIDTH + 39; // 2px border + 32px icon + 3px gap + text + 2px
const MOTD_DEFAULT = '#808080'; // the server list draws uncolored MOTD text in this gray
const OBF_POOL = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdeghmnopqrsuvwxyz0123456789#$%&?@';

/** Minecraft's drop shadow: each channel at 25% brightness. */
export const shadowOf = (hex) =>
  '#' + ((parseInt(hex.slice(1), 16) & 0xfcfcfc) >> 2).toString(16).padStart(6, '0');

function spanFor(seg) {
  const span = document.createElement('span');
  const hex = colorToHex(seg.color) ?? MOTD_DEFAULT;
  span.textContent = seg.text;
  span.style.color = hex;
  span.style.setProperty('--shadow', shadowOf(hex));
  const classes = { bold: 'b', italic: 'i', underlined: 'u', strikethrough: 's' };
  for (const [key, cls] of Object.entries(classes)) if (seg[key]) span.classList.add(cls);
  if (seg.obfuscated) span.dataset.obf = seg.text;
  return span;
}

const hueOf = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function createPreview(root) {
  const screen = root.querySelector('.screen');
  const lines = [...root.querySelectorAll('.motd-text')];
  const meters = [...root.querySelectorAll('.meter')];
  const name = root.querySelector('.server-name');
  const icon = root.querySelector('.server-icon');
  const spoken = root.querySelector('.preview-text');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0;

  screen.style.setProperty('--motd-width', MOTD_WIDTH);
  screen.style.setProperty('--row-width', ROW_WIDTH);
  meters.forEach((m) => m.setAttribute('aria-valuemax', String(MOTD_WIDTH)));

  function unit() {
    return parseFloat(getComputedStyle(screen).getPropertyValue('--u')) || 1;
  }

  function measure() {
    const u = unit();
    lines.forEach((line, i) => {
      const width = Math.round(line.getBoundingClientRect().width / u);
      const over = width - MOTD_WIDTH;
      const meter = meters[i];
      meter.classList.toggle('over', over > 0);
      meter.querySelector('.meter-fill').style.width = `${Math.min(100, (width / MOTD_WIDTH) * 100)}%`;
      meter.querySelector('.meter-value').textContent =
        over > 0 ? `${width}/${MOTD_WIDTH}px · ${over}px clipped` : `${width}/${MOTD_WIDTH}px`;
      meter.setAttribute('aria-valuenow', String(width));
      meter.setAttribute('aria-valuetext', over > 0 ? `${width} pixels, ${over} clipped` : `${width} pixels`);
    });
  }

  function scramble() {
    for (const span of root.querySelectorAll('[data-obf]')) {
      span.textContent = span.dataset.obf.replace(/\S/g, () => OBF_POOL[(Math.random() * OBF_POOL.length) | 0]);
    }
  }

  // Animate obfuscated text; under reduced motion, scramble once and hold still.
  function syncObfuscation() {
    clearInterval(timer);
    const any = root.querySelector('[data-obf]');
    if (any) scramble();
    timer = any && !motion.matches ? setInterval(scramble, 60) : 0;
  }
  motion.addEventListener('change', syncObfuscation);

  // Scale GUI pixels to fit the stage; snap to half steps once there's room.
  new ResizeObserver(([entry]) => {
    const fit = entry.contentRect.width / ROW_WIDTH;
    const u = fit >= 2 ? Math.min(3, Math.floor(fit * 2) / 2) : fit;
    screen.style.setProperty('--u', `${u}px`);
    measure();
  }).observe(screen);
  document.fonts?.ready.then(measure);

  return {
    render(segments, server) {
      const label = server.trim() || 'Minecraft Server';
      name.textContent = label;
      icon.dataset.letter = [...label][0].toUpperCase();
      icon.style.setProperty('--icon-hue', hueOf(label));
      const split = splitLines(segments);
      lines.forEach((line, i) => line.replaceChildren(...(split[i] ?? []).map(spanFor)));
      spoken.textContent = `${label}: ${split.slice(0, 2).map(toPlain).join(' / ')}`;
      syncObfuscation();
      measure();
    },
  };
}
