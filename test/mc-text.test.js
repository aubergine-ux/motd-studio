import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLegacy, serializeLegacy, parseJson, serializeJson, parseMiniMessage,
  serializeMiniMessage, toServerProperties, parseServerProperties, parseAny,
  nearestLegacy, normalizeColor, hasHex, splitLines, styleAtEnd, restoreCodes, toPlain,
} from '../js/mc-text.js';

const seg = (text, style = {}) => ({
  text, color: null, bold: false, italic: false,
  underlined: false, strikethrough: false, obfuscated: false, ...style,
});

// A sample that exercises every style flag, a newline and a reset.
const SAMPLE = [
  seg('Welcome to ', { color: 'gray' }),
  seg('Aurora', { color: 'light_purple', bold: true }),
  seg(' SMP', { color: 'dark_purple', bold: true, italic: true }),
  seg('\n'),
  seg('new ', { underlined: true }),
  seg('worlds', { color: 'gold', strikethrough: true }),
  seg(' ?? ', { color: 'yellow', obfuscated: true }),
  seg('join now'),
];

const HEX_SAMPLE = [
  seg('Ember', { color: '#ff7a59', bold: true }),
  seg('fall', { color: '#c084fc' }),
  seg(' survival', { color: 'gray' }),
];

const FORMATS = {
  ampersand: [(s) => serializeLegacy(s, '&'), (t) => parseLegacy(t, '&')],
  section: [(s) => serializeLegacy(s, '§'), (t) => parseLegacy(t, '§')],
  properties: [toServerProperties, parseServerProperties],
  json: [serializeJson, parseJson],
  minimessage: [serializeMiniMessage, parseMiniMessage],
};

describe('round-trips', () => {
  for (const [name, [write, read]] of Object.entries(FORMATS)) {
    test(`${name} preserves legacy-colored text`, () => {
      assert.deepEqual(read(write(SAMPLE)), SAMPLE);
    });
  }

  for (const [from, [write]] of Object.entries(FORMATS)) {
    for (const [to, [write2, read2]] of Object.entries(FORMATS)) {
      test(`${from} -> ${to} via auto-detect`, () => {
        const { segments } = parseAny(write(SAMPLE));
        assert.deepEqual(read2(write2(segments)), SAMPLE);
      });
    }
  }

  test('hex colors survive JSON and MiniMessage', () => {
    assert.deepEqual(parseJson(serializeJson(HEX_SAMPLE)), HEX_SAMPLE);
    assert.deepEqual(parseMiniMessage(serializeMiniMessage(HEX_SAMPLE)), HEX_SAMPLE);
  });

  test('hex colors survive the editor dialect (&#rrggbb) and §x form', () => {
    assert.deepEqual(parseLegacy(serializeLegacy(HEX_SAMPLE, '&', 'hash'), '&'), HEX_SAMPLE);
    assert.deepEqual(parseLegacy(serializeLegacy(HEX_SAMPLE, '§', 'x'), '§'), HEX_SAMPLE);
  });

  test('auto-detect reports the right format', () => {
    for (const [name, [write]] of Object.entries(FORMATS)) {
      assert.equal(parseAny(write(SAMPLE)).format, name);
    }
  });
});

describe('legacy color-resets-formatting rule', () => {
  test('a color code after a format code clears the format', () => {
    assert.deepEqual(parseLegacy('&l&6Gold'), [seg('Gold', { color: 'gold' })]);
  });

  test('format codes after a color code stack', () => {
    assert.deepEqual(parseLegacy('&6&l&oGold'), [seg('Gold', { color: 'gold', bold: true, italic: true })]);
  });

  test('a mid-string color change drops bold', () => {
    assert.deepEqual(parseLegacy('&a&lBold &bplain'), [
      seg('Bold ', { color: 'green', bold: true }),
      seg('plain', { color: 'aqua' }),
    ]);
  });

  test('hex colors also reset formatting', () => {
    assert.deepEqual(parseLegacy('&l&#123456x'), [seg('x', { color: '#123456' })]);
  });

  test('&r returns to the default style', () => {
    assert.deepEqual(parseLegacy('&c&lHot&r cold'), [seg('Hot', { color: 'red', bold: true }), seg(' cold')]);
  });

  test('serializer re-applies formats after every color change', () => {
    const out = serializeLegacy([seg('A', { color: 'red', bold: true }), seg('B', { color: 'blue', bold: true })]);
    assert.equal(out, '&c&lA&9&lB');
  });

  test('serializer re-emits the color to turn a format off', () => {
    const out = serializeLegacy([seg('A', { color: 'red', bold: true }), seg('B', { color: 'red' })]);
    assert.equal(out, '&c&lA&cB');
  });

  test('serializer uses &r to drop back to the default color', () => {
    assert.equal(serializeLegacy([seg('A', { color: 'red' }), seg('B', { italic: true })]), '&cA&r&oB');
  });

  test('formatting carries across the line break', () => {
    const lines = splitLines(parseLegacy('&6&lTop\nBottom'));
    assert.equal(lines[1][0].bold, true);
    assert.equal(lines[1][0].color, 'gold');
  });
});

describe('nearest-color fallback', () => {
  test('exact legacy values map to themselves', () => {
    assert.equal(nearestLegacy('#ffaa00'), 'gold');
    assert.equal(nearestLegacy('#55ffff'), 'aqua');
  });

  test('near values snap to the closest legacy color', () => {
    assert.equal(nearestLegacy('#fe5050'), 'red');
    assert.equal(nearestLegacy('#0a0a0a'), 'black');
    assert.equal(nearestLegacy('#f0f0f0'), 'white');
    assert.equal(nearestLegacy('#b000b0'), 'dark_purple');
    assert.equal(nearestLegacy('#ffb000'), 'gold');
  });

  test('legacy exports replace hex with the nearest legacy color', () => {
    assert.equal(serializeLegacy([seg('x', { color: '#fe5050' })], '&'), '&cx');
    assert.equal(toServerProperties([seg('x', { color: '#0a0a0a' })]), 'motd=\\u00A70x');
  });

  test('hasHex flags only true hex colors', () => {
    assert.equal(hasHex(SAMPLE), false);
    assert.equal(hasHex(HEX_SAMPLE), true);
  });

  test('hex equal to a legacy color is normalized to its name', () => {
    assert.equal(normalizeColor('#FFAA00'), 'gold');
    assert.equal(normalizeColor('dark_grey'), 'dark_gray');
    assert.equal(normalizeColor('#C084FC'), '#c084fc');
  });
});

describe('format details', () => {
  test('server.properties escapes § and newlines', () => {
    assert.equal(toServerProperties(parseLegacy('&6Hi\n&7there')), 'motd=\\u00A76Hi\\n\\u00A77there');
  });

  test('server.properties escapes non-ASCII and backslashes', () => {
    assert.equal(toServerProperties([seg('a\\b»')]), 'motd=a\\\\b\\u00BB');
    assert.deepEqual(parseServerProperties('motd=a\\\\b\\u00BB'), [seg('a\\b»')]);
  });

  test('JSON children inherit parent style and the array shorthand works', () => {
    const segs = parseJson('[{"text":"A","color":"gold","bold":true},{"text":"B","bold":false},"C"]');
    assert.deepEqual(segs, [
      seg('A', { color: 'gold', bold: true }),
      seg('B', { color: 'gold' }),
      seg('C', { color: 'gold', bold: true }),
    ]);
  });

  test('JSON accepts a status response "description" wrapper', () => {
    assert.deepEqual(parseJson('{"description":{"text":"Hi","color":"aqua"}}'), [seg('Hi', { color: 'aqua' })]);
  });

  test('MiniMessage nests tags and closes only what changes', () => {
    assert.equal(
      serializeMiniMessage([seg('A', { color: 'gold', bold: true }), seg('B', { color: 'gold' })]),
      '<gold><bold>A</bold>B',
    );
  });

  test('MiniMessage parses aliases, hex, negation and reset', () => {
    assert.deepEqual(parseMiniMessage('<c:#C084FC><b>A<!b>B</c><reset>C'), [
      seg('A', { color: '#c084fc', bold: true }),
      seg('B', { color: '#c084fc' }),
      seg('C'),
    ]);
  });

  test('MiniMessage treats unknown tags and escapes as literal text', () => {
    assert.equal(toPlain(parseMiniMessage('a <3 b <div> \\<gold> </div>')), 'a <3 b <div> <gold> </div>');
    assert.equal(toPlain(parseMiniMessage(serializeMiniMessage([seg('x <red> \\ y')]))), 'x <red> \\ y');
  });

  test('MiniMessage strips unsupported decorative tags', () => {
    assert.equal(toPlain(parseMiniMessage('<gradient:red:blue>Hi</gradient>')), 'Hi');
  });

  test('& text that is not a code stays literal', () => {
    assert.deepEqual(parseLegacy('Tom & Jerry &z'), [seg('Tom & Jerry &z')]);
  });

  test('styleAtEnd and restoreCodes describe the active style', () => {
    const style = styleAtEnd('&6&lHello &o');
    const { text, ...expected } = seg('', { color: 'gold', bold: true, italic: true });
    assert.deepEqual(style, expected);
    assert.equal(restoreCodes(style), '&6&l&o');
    assert.equal(restoreCodes(styleAtEnd('plain')), '&r');
  });
});
