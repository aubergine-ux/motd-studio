// Export panel: one card per format with a copy button and hex warnings.
import {
  serializeLegacy, serializeJson, serializeMiniMessage, toServerProperties,
  nearestLegacy, isHexColor,
} from './mc-text.js';

export const EXPORTS = [
  { id: 'properties', title: 'server.properties', hint: 'Paste into server.properties', hex: false, write: toServerProperties },
  { id: 'section', title: 'Raw § codes', hint: 'Plugins and configs that take §', hex: false, write: (s) => serializeLegacy(s, '§') },
  { id: 'ampersand', title: '& codes', hint: 'Most plugin configs', hex: false, write: (s) => serializeLegacy(s, '&') },
  { id: 'json', title: 'JSON text component', hint: 'Status responses, proxies, datapacks', hex: true, write: serializeJson },
  { id: 'minimessage', title: 'MiniMessage', hint: 'Paper, Velocity and Adventure', hex: true, write: serializeMiniMessage },
];

/** Copy text, falling back to a hidden textarea when the async API is unavailable. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Show feedback on a copy button for a moment. */
export function flashCopied(button, ok, announce) {
  const label = button.querySelector('.copy-label');
  button.classList.toggle('copied', ok);
  button.classList.toggle('failed', !ok);
  label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  announce(ok ? `Copied ${button.dataset.what}` : 'Copy failed, select the text and copy it manually');
  clearTimeout(button._timer);
  button._timer = setTimeout(() => {
    button.classList.remove('copied', 'failed');
    label.textContent = 'Copy';
  }, 1600);
}

export function createExports(container, template, announce) {
  const cards = EXPORTS.map((fmt) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.export-title').textContent = fmt.title;
    node.querySelector('.export-hint').textContent = fmt.hint;
    const badge = node.querySelector('.badge');
    badge.textContent = fmt.hex ? 'Hex ✓' : 'Legacy';
    badge.classList.add(fmt.hex ? 'badge-hex' : 'badge-legacy');
    badge.title = fmt.hex ? 'Keeps hex colors' : 'Only the 16 legacy colors';
    const code = node.querySelector('code');
    code.id = `export-${fmt.id}`;
    const button = node.querySelector('.copy');
    button.dataset.what = fmt.title;
    button.setAttribute('aria-label', `Copy ${fmt.title}`);
    button.addEventListener('click', async () => {
      const ok = await copyText(code.textContent);
      if (!ok) getSelection().selectAllChildren(code); // leave it ready for a manual copy
      flashCopied(button, ok, announce);
    });
    container.append(node);
    return { fmt, code, warn: node.querySelector('.warn') };
  });

  return {
    update(segments) {
      const hexes = [...new Set(segments.map((s) => s.color).filter(isHexColor))];
      const swaps = hexes.map((h) => `${h} → ${nearestLegacy(h).replace('_', ' ')}`).join(', ');
      for (const { fmt, code, warn } of cards) {
        code.textContent = fmt.write(segments);
        const lossy = !fmt.hex && hexes.length > 0;
        warn.hidden = !lossy;
        if (lossy) warn.textContent = `Hex colors replaced with the nearest legacy color: ${swaps}.`;
      }
    },
  };
}
