---
name: Hebrew RTL PDF generation
description: How to reliably generate Hebrew (RTL) PDFs in this Nix environment
---

# Hebrew RTL PDF generation

Use **fpdf2 + python-bidi + the Alef TTF font**, run via `uv`. This is the reliable path on this host.

**Why:** Headless browsers (Playwright/Puppeteer Chromium) FAIL to launch here — the Nix host is missing the system shared libs Chromium needs (`validateDependenciesLinux` error). weasyprint/pandoc/wkhtmltopdf are not installed and weasyprint needs native pango/cairo. So pure-Python with no native deps is the only thing that just works.

**How to apply:**
- Tooling dir: `.local/pdfgen/` (isolated, holds `Alef-Regular.ttf` + `Alef-Bold.ttf`, downloaded from `github.com/google/fonts/raw/main/ofl/alef/`).
- Run: `uv run --with fpdf2 --with python-bidi python <script>.py` (pure-python wheels, instant install). Render-to-PNG check: `uv run --with pypdfium2 --with pillow python ...`.
- **Manual line-wrapping is mandatory.** Apply `bidi.algorithm.get_display()` PER VISUAL LINE *after* you wrap, never to a whole paragraph — fpdf's own `multi_cell` wrapping operates on already-reversed text and breaks. So: measure/wrap logical text with `get_string_width`, then render each wrapped line with `cell(..., align="R")` on `get_display(line)`, tracking Y and page-breaks yourself (`set_auto_page_break(False)`).
- `multi_cell(0, ...)` (w=0) threw "Not enough horizontal space"; pass an explicit width (`pdf.epw`) instead.
- Alef lacks arrow glyphs (e.g. `←` U+2190) — reword flows in Hebrew instead of using arrows.
- Output goes to `docs/AgentHub-Spec.pdf`; deliver via `present_asset` with a workspace-relative path.
