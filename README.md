# vCard

Home of [tomasmuller.dev](https://tomasmuller.dev?utm_source=vCard).

One page, no build step and no dependencies: `index.html` holds the markup, styles and script. `main` is the live site.

- `fonts/` holds [Allo](https://github.com/joshpuckett/allo) 1.0.3 (SIL Open Font License, `fonts/OFL.txt`), subset to the letters the page uses:

  ```sh
  pyftsubset AlloVariable.woff2 --text="Tomás Augusto Müller Logs LinkedIn" --flavor=woff2 \
    --layout-features=kern,liga,calt,mark,mkmk,ccmp,locl --output-file=fonts/allo-1.0.3-subset.woff2
  ```

- `og.png` is the share image: the page at 1200×630 with scripts off and the dark color scheme.
- `_tools/` is not published. `node _tools/swatches.mjs` prints the color tables embedded in `index.html`, and `node --test` checks the page against its rules (colors, contrast, name, links).
