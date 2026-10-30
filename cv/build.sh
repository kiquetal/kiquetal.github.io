#!/usr/bin/env bash
# Build ATS-friendly CV PDFs from Markdown using Pandoc + WeasyPrint.
# Usage: ./build.sh            (builds both languages)
#        ./build.sh en|es      (builds one language)
set -euo pipefail

cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:$PATH"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "ERROR: pandoc not found. See README.md -> Install." >&2
  exit 1
fi

build_one() {
  local lang="$1"
  local src="cv-${lang}.md"
  local out="cv-${lang}.pdf"
  [ -f "$src" ] || { echo "skip: $src not found"; return; }
  echo "Building $out ..."
  # The document's own "# Name" H1 is the title; we suppress pandoc's
  # title block (-V title="") so the name is the first visible line.
  pandoc "$src" \
    --from=markdown \
    --to=html5 \
    --standalone \
    --css=style.css \
    --pdf-engine=weasyprint \
    --metadata pagetitle="CV" \
    -o "$out"
  echo "  -> $out ($(wc -c < "$out") bytes)"
}

if [ "${1:-}" = "" ]; then
  build_one en
  build_one es
else
  build_one "$1"
fi

echo "Done."
