# Implementation Plan — ATS-Friendly Bilingual CV Skeleton (Markdown → Pandoc → PDF)

## Problem Statement
Create an ATS-safe, single-column CV template/skeleton in Markdown (English + Spanish)
that generates text-based PDFs via Pandoc. The user fills in real content and references
later, then re-generates the PDFs. This is a standalone document-generation task, **not**
an Astro web page, and must not interfere with the existing Astro portfolio build/deploy.

> Context note: "ATS" = Applicant Tracking System (automated resume screeners), not "Astro".

## Clarified Requirements
- Output: PDF only, text-based (selectable/extractable text, not an image/scan), single column.
- Generation: Markdown → Pandoc (plain-text source, easy to edit, keeps text selectable).
- Bilingual: two separate documents — `cv-en.pdf` and `cv-es.pdf`.
- Start with a placeholder skeleton; user adds real info + references afterward and regenerates.

## ATS Best Practices (design constraints)
- Single column layout. No tables, text boxes, images, icons, or graphics.
- No critical info in headers/footers.
- Standard section headings: Summary, Experience, Education, Skills, Certifications, Languages
  (optionally Projects / References).
- Simple bullets, standard fonts, consistent `MM/YYYY` dates.
- Text-based PDF output so parsers can extract content.

## Solution
A dedicated `cv/` folder (separate from the Astro site) containing `cv-en.md` and `cv-es.md`
skeletons with labeled placeholders, a minimal single-column print stylesheet, a Pandoc +
WeasyPrint build script, and a README with fill-in instructions and an ATS checklist.
Generated PDFs are git-ignored.

## Toolchain
- Pandoc 3.1.11.1 (static binary → `~/.local/bin`)
- WeasyPrint (HTML → PDF engine, installed via `pip --user`)
- Build: `pandoc <src>.md --from=markdown --to=html5 --standalone --css=style.css --pdf-engine=weasyprint --metadata pagetitle="CV" -o <out>.pdf`

## Task Breakdown
- [x] Task 1: Set up the `cv/` workspace and document the build (README, style.css, build.sh, .gitignore).
- [x] Task 2: Author the English CV skeleton (`cv-en.md`).
- [x] Task 3: Generate `cv-en.pdf` and verify ATS-safety (selectable text, single column, no images).
- [x] Task 4: Author the Spanish skeleton (`cv-es.md`) and generate `cv-es.pdf`.
- [x] Task 5: Final review, polish, handoff notes, cleanup.

## Verification Summary
- Both PDFs build via `./build.sh` (cv-en.pdf ~18.5 KB, cv-es.pdf ~16 KB).
- Text fully extractable (pdfminer: 2520 chars EN / 2546 chars ES).
- Zero images on every page (pymupdf); single column; standard headings; 2 pages each.
- Structural parity: both files have 8 sections and 6 entries.
- Astro site untouched; PDFs git-ignored.
