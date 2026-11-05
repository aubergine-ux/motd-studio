# motd-studio

Design your Minecraft server's MOTD, see it in a server-list preview as you type, and copy it out in whatever format your server wants.

![screenshot](docs/screenshot.png)

![demo](docs/demo.gif)

Try it: https://armd.one/motd-studio/

## Why

Writing an MOTD usually means editing `server.properties`, restarting, opening the game, and finding out the second line is cut off or the bold vanished. Then you do it again. This lets you skip most of that loop.

## What it does

You type into a plain two-line textarea using `&` codes. Select some text and click a color or format in the toolbar, and it wraps the selection and puts the previous style back after it. Ctrl+B / I / U and undo work like you'd expect.

The preview above it renders a server-list row with the real legacy color values and the game's 1px drop shadow. `&k` text scrambles (it holds still if you've turned on reduced motion). Under the preview, a meter for each line shows how much of the 270px visible width you've used, and anything past that gets clipped.

From there you can copy it out in five formats, or paste an existing MOTD in any of them and it figures out which one it is. The URL updates as you type, so you can send someone a link, and your last session comes back when you reopen the page. There are a few starter templates if you'd rather not start from nothing.

It's plain HTML, CSS and JS modules. No framework, no build.

## Export formats

| Format | Example | Hex colors |
| --- | --- | :---: |
| `server.properties` | `motd=\u00A76Hi\n\u00A77there` | no |
| `§` codes | `§6Hi` | no |
| `&` codes | `&6Hi` | no |
| JSON text component | `{"text":"Hi","color":"#C084FC"}` | yes |
| MiniMessage | `<#c084fc>Hi` | yes |

The three legacy formats only know 16 colors. If you've used a hex color, those exports swap it for the closest legacy one and tell you what they swapped.

## The color code gotcha

In Java Edition, a color code turns off any formatting that came before it:

```
&l&6Gold       gold, not bold. The &6 cancelled the &l
&6&lGold       gold and bold
&a&lHi &bthere "Hi" is bold green, "there" is plain aqua
```

So formats have to come after the color, every time the color changes. The editor follows the same rule the game does, so the preview won't lie to you about it, and the exports add the codes back after each color change. JSON and MiniMessage nest their styles, so they don't have this problem.

The "Color reset quirk" template shows it side by side.

## Code reference

| Code | Color | Hex | | Code | Color | Hex |
| --- | --- | --- | --- | --- | --- | --- |
| `&0` | black | `#000000` | | `&8` | dark_gray | `#555555` |
| `&1` | dark_blue | `#0000AA` | | `&9` | blue | `#5555FF` |
| `&2` | dark_green | `#00AA00` | | `&a` | green | `#55FF55` |
| `&3` | dark_aqua | `#00AAAA` | | `&b` | aqua | `#55FFFF` |
| `&4` | dark_red | `#AA0000` | | `&c` | red | `#FF5555` |
| `&5` | dark_purple | `#AA00AA` | | `&d` | light_purple | `#FF55FF` |
| `&6` | gold | `#FFAA00` | | `&e` | yellow | `#FFFF55` |
| `&7` | gray | `#AAAAAA` | | `&f` | white | `#FFFFFF` |

| Code | Format | MiniMessage |
| --- | --- | --- |
| `&l` | bold | `<bold>` or `<b>` |
| `&o` | italic | `<italic>` or `<i>` |
| `&n` | underline | `<underlined>` or `<u>` |
| `&m` | strikethrough | `<strikethrough>` or `<st>` |
| `&k` | obfuscated | `<obfuscated>` or `<obf>` |
| `&r` | reset | `<reset>` |
| `&#rrggbb` | hex color | `<#rrggbb>` |

`&#rrggbb` is something the editor understands, not vanilla. Import also reads Spigot's `§x§r§r§g§g§b§b` form.

## Running it locally

ES modules won't load over `file://`, so you need some kind of server:

```sh
npx serve .
# or
python -m http.server
```

## Tests

```sh
npm test
```

This runs Node's built-in test runner (Node 18+, nothing to install). The tests cover converting between every pair of formats, the color reset rule, and the hex fallback.

## Deploying

It's a static site with relative paths, so GitHub Pages works as-is. Go to Settings → Pages, deploy from the `main` branch, root folder.

## Notes

- The visible width lives in one constant, `MOTD_WIDTH` in `js/preview.js`, if you want to tune it.
- The preview font is monospaced and Minecraft's isn't, so the width meter is close but not exact. Narrow letters like `i` and `l` take less room in game.
- `js/mc-text.js` doesn't touch the DOM. All the parsing and serializing is in there if you want it for something else.

## Credits

The preview uses [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan, under the [SIL Open Font License 1.1](fonts/Monocraft-OFL.txt). The UI is set in [IBM Plex Mono](https://github.com/IBM/plex), also OFL. There are no Mojang textures, fonts or logos in here. The background, icon and ping bars are all CSS.

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.

## License

[MIT](LICENSE) © 2026 Aubergine-UX
