# AWS Builder Center / community.aws Drafts

Drafts formatted for cross-posting to **community.aws** (AWS Builder Center) and
similar AWS community channels.

## How to use this folder

1. Drop your **previous published posts** here (as reference/examples) so the
   format and voice can be reused for new AWS community entries.
2. New entries are generated from the original blog post in
   `../src/content/blog/`, adapted to the AWS community style.

## Cross-posting checklist (do NOT skip)

- [ ] **Canonical URL** — always point back to the original on `kiquetal.dev`.
      Duplicate content without a canonical tag lowers SEO rankings.
- [ ] Publish the original on kiquetal.dev first; verify the live URL works.
- [ ] Then cross-post here with the canonical link set.
- [ ] Keep the "architecture and reasoning, not full implementation" stance —
      no Envoy config, no full plugin code.
- [ ] **Export diagrams as PNG** — Builder Center's editor is unreliable with
      SVG. Generate PNGs under `../public/blog/<slug>/` (so they're also served
      live) and reference the PNG, not the SVG, in this draft.
- [ ] **Every image marker is self-contained** — each `[📷 UPLOAD IMAGE HERE: …]`
      marker MUST be immediately followed by the file path AND the live URL (see
      format below), so whoever pastes the article can locate the image on the
      spot without scrolling to a checklist.

## Image marker format (REQUIRED)

Each image placeholder must follow this exact three-line pattern, inline at the
position where the image belongs:

```
[📷 UPLOAD IMAGE HERE: <short description> — <filename>.png]
> File: public/blog/<slug>/<filename>.png
> URL:  https://kiquetal.dev/blog/<slug>/<filename>.png
```

- **File** = the local repo path (upload the file from here).
- **URL** = the live public URL (paste directly into the editor as an alternative).
- Always `.png` for the marker; keep the `.svg` source in the same folder.
- Regenerate a PNG after editing its SVG:
  `python3 -c "import cairosvg; cairosvg.svg2png(url='<file>.svg', write_to='<file>.png', output_width=1770)"`
  (1770px wide = 1.5× for crisp text when Builder Center scales it).

Still keep a summary image checklist at the END of the draft listing all images,
their sections, and URLs — the inline markers are for placement, the checklist
is the at-a-glance index.

## Reference

- community.aws / AWS Builder Center — open to anyone, not just Community Builders.
- Set canonical to: `https://kiquetal.dev/blog/<slug>`
