# Dinnerfolk logo files

## Contents
| File | Use |
|---|---|
| `svg/dinnerfolk-wordmark-on-light.svg` | Wordmark A for light backgrounds: #16110E lettering, #C8230A full stop. Transparent background, letters as paths. |
| `svg/dinnerfolk-wordmark-on-dark.svg` | Wordmark A for black: #FFFFFF lettering, #FF6347 full stop. Transparent background, letters as paths. |
| `svg/dinnerfolk-icon-c.svg` | Icon C: white D and #FF6347 dot on a #16110E rounded tile (18% radius). |
| `png/dinnerfolk-icon-c-180.png`, `-192.png`, `-512.png` | Icon C rendered from the SVG, with transparent rounded corners. |
| `favicon.ico` | 16, 32 and 48px frames of icon C. |
| `source/` | The editable originals: the build script and the two font files it uses. |

The SVGs are the master files. In each, layers are named: `lettering` and `full-stop` in the wordmarks; `tile`, `letter-D` and `full-stop` in the icon. They open and edit as ordinary vector shapes in Figma, Illustrator or Affinity.

## Please verify: weight 800 is reconstructed
The only Bricolage Grotesque files available when these were made were static Regular (400) and Bold (700). The logo uses ExtraBold (800). The script rebuilds 800 by extending the line from 400 through 700 for every outline point, advance and kerning pair. The outlines are point-compatible, so this works, and the result looks right, but it is an approximation rather than the font's own ExtraBold.

To make exact outlines, download the variable font from Google Fonts and run:

    cd source
    python3 build_logo_assets.py --variable path/to/BricolageGrotesque[opsz,wdth,wght].ttf

That takes weight 800 (optical size 14, width 100, the defaults the web app uses) straight from the font. The `--variable` route has not been run here, so check the output. Compare the new wordmark with the old one by overlaying them; if they match, nothing changes. If they differ, use the new files.

## Details
- **Spacing:** letter-spacing is −0.035em with the font's own kerning, and the full stop is the font's period glyph, coloured. This is wordmark A from the refinement sheet.
- **Icon C geometry:** D at 70% of the tile height, a drawn dot at 12%, a gap of 1.5%, letter-spacing −2%. The D and dot are centred as one group on the D's actual ink, so they sit slightly more precisely than the live-text sheet did.
- **Crop:** the wordmark SVGs are cropped tight to the ink with no padding. Add clear space (the height of the D on every side) in layout.
- **Rounded corners:** the PNGs and the SVG icon have transparent rounded corners. For `apple-touch-icon.png` and Android maskable icons, a full-bleed square is better: iOS and Android apply their own masks. Change `ICON_R` to `0` in the script to make one.
- **Favicon tags**

      <link rel="icon" href="/favicon.ico" sizes="48x48">
      <link rel="icon" href="/dinnerfolk-icon-c.svg" type="image/svg+xml">
      <link rel="apple-touch-icon" href="/dinnerfolk-icon-c-180.png">

  For a web manifest use the 192 and 512 PNGs.

## Rebuilding
`source/build_logo_assets.py` regenerates everything. It needs `fonttools`, `numpy`, `pillow` and `playwright` with Chromium. The PNGs and ICO frames are rasterised from the SVG in Chromium, with exact anti-aliased transparency.

## Licence
Bricolage Grotesque is licensed under the SIL Open Font License 1.1 (`source/BricolageGrotesque-OFL.txt`). Converting the letters to outlines for a logo is permitted.
