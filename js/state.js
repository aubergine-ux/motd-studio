// Session state: URL hash (shareable) first, then localStorage, then a template.

const STORAGE_KEY = 'motd-studio:v1';

export const TEMPLATES = [
  {
    id: 'aurora', name: 'Aurora SMP', server: 'Aurora SMP',
    motd: '&d&lAURORA &5&lSMP &8» &7Season 4 is live\n&f&oNew biomes, old friends. &7Come say hi!',
  },
  {
    id: 'ember', name: 'Emberfall', server: 'Emberfall',
    motd: '&#ff7a59&lEMBER&#ffb347&lFALL &8| &7Survival+\n&#c084fcCozy builds &8• &#e8d5ffNo resets, ever',
  },
  {
    id: 'maintenance', name: 'Maintenance', server: 'Lantern Network',
    motd: '&e&k||&r &6&lUNDER MAINTENANCE &e&k||\n&7Back shortly. &nFollow updates&r&7 on our site.',
  },
  {
    id: 'pebble', name: 'Pebble', server: 'Pebble',
    motd: '&f&lPEBBLE &7a quiet vanilla world\n&8est. 2026 · whitelist only',
  },
  {
    id: 'arcade', name: 'Pixel Arcade', server: 'Pixel Arcade',
    motd: '&b&lPIXEL &d&lARCADE &f[1.21]\n&a▶ &fMinigames &8• &fParkour &8• &fSkywars',
  },
  {
    id: 'quirk', name: 'Color reset quirk', server: 'Format Lab',
    motd: '&l&6Gold, not bold &8— &6&lgold and bold\n&7A color code clears &obold/italic&7 before it.',
  },
];

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('motd')) return null;
  return { motd: params.get('motd'), server: params.get('server') ?? 'Minecraft Server' };
}

function readStorage() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return typeof data?.motd === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function loadState() {
  const t = TEMPLATES[0];
  return readHash() ?? readStorage() ?? { motd: t.motd, server: t.server };
}

export function shareUrl(state) {
  const params = new URLSearchParams({ motd: state.motd, server: state.server });
  return `${location.href.split('#')[0]}#${params}`;
}

let timer = 0;
export function saveState(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    history.replaceState(null, '', shareUrl(state));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be full or blocked (private mode); the URL still holds the state.
    }
  }, 250);
}

/** Call `fn` when someone navigates to a different shared link in this tab. */
export const onExternalChange = (fn) =>
  window.addEventListener('hashchange', () => { const s = readHash(); if (s) fn(s); });
