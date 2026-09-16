# PDF export fonts

`Roboto-Regular.ttf`, `Roboto-Bold.ttf` — Google, Apache License 2.0.
Source: https://github.com/googlefonts/roboto-2

pdfkit only ships the 14 standard PDF fonts, none of which cover Vietnamese
diacritics; without an embedded font those characters render as boxes, silently.

`src/assets` is copied to `dist` by webpack, so `join(__dirname, 'assets/fonts')`
resolves in both dev and production. pdfkit subsets the font, so generated PDFs
stay small despite the ~500 KB source files.
