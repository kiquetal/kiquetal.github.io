# CV Workspace (ATS-friendly)

Standalone, single-column CV skeletons that generate **text-based PDFs** (selectable text,
no images/tables) designed to pass automated **Applicant Tracking System (ATS)** screeners.

> This folder is **independent of the Astro site**. Nothing here affects `npm run build`,
> the `src/` tree, or the GitHub Pages deploy. The `*.pdf` outputs are git-ignored.

## Files

| File        | Purpose                                  |
| :---------- | :--------------------------------------- |
| `cv-en.md`  | English CV skeleton (fill in the blanks) |
| `cv-es.md`  | Spanish CV skeleton (fill in the blanks) |
| `style.css` | Minimal print stylesheet (single column) |
| `build.sh`  | Generates both PDFs                       |
| `cv-en.pdf` | Generated output (git-ignored)           |
| `cv-es.pdf` | Generated output (git-ignored)           |

## Toolchain

- **[Pandoc](https://pandoc.org)** — Markdown → HTML/PDF converter.
- **[WeasyPrint](https://weasyprint.org)** — HTML → PDF engine (pure Python, text-based output).

### Install (no sudo required)

```bash
# Pandoc (static binary to ~/.local/bin)
mkdir -p ~/.local/bin ~/.local/pandoc
curl -fsSL https://github.com/jgm/pandoc/releases/download/3.1.11.1/pandoc-3.1.11.1-linux-amd64.tar.gz \
  | tar xz -C ~/.local/pandoc --strip-components=1
cp ~/.local/pandoc/bin/pandoc ~/.local/bin/pandoc

# WeasyPrint (PDF engine)
python3 -m pip install --user weasyprint

# Make sure ~/.local/bin is on PATH
export PATH="$HOME/.local/bin:$PATH"
```

> Alternative: `sudo apt-get install pandoc weasyprint` if you prefer system packages.

## Build

```bash
./build.sh            # builds both cv-en.pdf and cv-es.pdf
```

Or manually, one language at a time:

```bash
export PATH="$HOME/.local/bin:$PATH"

pandoc cv-en.md \
  --from=markdown \
  --to=html5 \
  --standalone \
  --css=style.css \
  --pdf-engine=weasyprint \
  --metadata title="CV" \
  -o cv-en.pdf
```

## How to fill in and regenerate

1. Open `cv-en.md` (and `cv-es.md`) in any text editor.
2. Replace every `[Placeholder]` with your real information.
3. Delete any section you don't need; add rows by copying an existing bullet/entry.
4. Re-run `./build.sh` to regenerate the PDFs.
5. Open the PDF and **try to select/copy the text** — if you can, an ATS can read it too.

## ATS Do / Don't checklist

**Do**

- [ ] Keep a single column, top-to-bottom reading order.
- [ ] Use the standard section headings (Summary, Experience, Education, Skills, Certifications, Languages).
- [ ] Use consistent `MM/YYYY` dates (e.g. `03/2021 – Present`).
- [ ] Spell out acronyms at least once, e.g. "Amazon Web Services (AWS)".
- [ ] Mirror keywords from the target job description in Summary/Skills/Experience.
- [ ] Keep it to 1–2 pages; put the most relevant experience first.
- [ ] Export/keep it as a **text-based PDF** (selectable text).

**Don't**

- [ ] No tables, text boxes, columns, or sidebars.
- [ ] No images, icons, logos, charts, or headshots.
- [ ] No critical info inside headers/footers (parsers often skip them).
- [ ] No fancy/decorative fonts or heavy color.
- [ ] No contact details as an image — keep them as plain text.
