// Wires the editor, preview, exports and persisted state together.
import { parseLegacy, parseAny, serializeLegacy } from './mc-text.js';
import { createEditor } from './editor.js';
import { createPreview } from './preview.js';
import { createExports, copyText, flashCopied } from './export.js';
import { TEMPLATES, loadState, saveState, shareUrl, onExternalChange } from './state.js';

const $ = (sel) => document.querySelector(sel);
const FORMAT_NAMES = {
  properties: 'server.properties line', section: '§ codes', ampersand: '& codes',
  json: 'JSON text component', minimessage: 'MiniMessage',
};

const live = $('#live');
const announce = (msg) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };

let state = loadState();
const serverInput = $('#server-name');
const preview = createPreview($('#preview'));
const exports = createExports($('#exports'), $('#export-card'), announce);
const editor = createEditor({
  textarea: $('#motd'),
  toolbar: $('#toolbar'),
  onChange(value) { state.motd = value; refresh(); },
});

function refresh() {
  const segments = parseLegacy(state.motd, '&');
  preview.render(segments, state.server);
  exports.update(segments);
  saveState(state);
  for (const chip of document.querySelectorAll('.template')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.motd === state.motd));
  }
}

function hydrate(next) {
  state = { motd: next.motd, server: next.server ?? '' };
  editor.load(state.motd);
  serverInput.value = state.server;
  refresh();
}

// Templates
const templates = $('#templates');
for (const t of TEMPLATES) {
  const chip = Object.assign(document.createElement('button'), {
    type: 'button', className: 'template', textContent: t.name,
  });
  chip.dataset.motd = t.motd;
  chip.addEventListener('click', () => {
    state.server = t.server;
    serverInput.value = t.server;
    editor.set(t.motd);
    state.motd = editor.value;
    refresh();
    announce(`Loaded template ${t.name}. Press Ctrl+Z in the editor to undo.`);
  });
  templates.append(chip);
}

serverInput.addEventListener('input', () => { state.server = serverInput.value; refresh(); });

$('#shadow-toggle').addEventListener('change', (ev) => {
  $('#preview').classList.toggle('no-shadow', !ev.target.checked);
});

$('#share').addEventListener('click', async (ev) => {
  const button = ev.currentTarget;
  flashCopied(button, await copyText(shareUrl(state)), announce);
});

// Import
const importInput = $('#import-text');
const importStatus = $('#import-status');
function runImport() {
  const raw = importInput.value;
  importStatus.classList.remove('error');
  if (!raw.trim()) {
    importStatus.textContent = 'Paste an MOTD first.';
    importStatus.classList.add('error');
    return;
  }
  const { format, segments } = parseAny(raw);
  const lines = serializeLegacy(segments, '&', 'hash').split('\n');
  editor.set(lines.slice(0, 2).join('\n'));
  state.motd = editor.value;
  refresh();
  const dropped = lines.length > 2 ? ` Kept the first 2 of ${lines.length} lines.` : '';
  importStatus.textContent = `Loaded as ${FORMAT_NAMES[format]}.${dropped}`;
  announce(importStatus.textContent);
}
$('#import-run').addEventListener('click', runImport);
importInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); runImport(); }
});

onExternalChange(hydrate);
hydrate(state);
