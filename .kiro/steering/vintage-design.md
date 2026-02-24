# Kiquetal Design System - Steering Guide

## Purpose
This guide defines the vintage design style and co-design attribution for all infographics and UI designs.

## Workflow
When creating infographics, ALWAYS use the MCP superdesign tools to properly manage design files in the `superdesign/design_iterations/` folder.

## Vintage Style Requirements

### Colors
- Cream: `#F5E6D3`
- Tan: `#E8D5C4` 
- Beige: `#D2B48C`
- Brown: `#8B7355`
- Dark Brown: `#5C4A3A`

Use warm sepia gradients. No pure black except in ribbon.

### Typography
**Headings:** Playfair Display, Libre Baskerville, Cormorant Garamond (serif, bold, 36-48px)
**Body:** Crimson Text, Lora, EB Garamond (serif, 14-16px)
**Letter-spacing:** 0.05-0.15em for headings

### Visual Elements
- Borders: 2-8px solid `#8B7355`
- Paper texture: Repeating linear gradients with 3% opacity
- Box shadows: `0 8px 24px rgba(0,0,0,0.3)`
- Minimal rounded corners: 2-4px
- Ornamental dividers: ✦, ❦, horizontal lines

### Layout
- Padding: 24-32px
- Element spacing: 12-16px
- Semi-transparent backgrounds: `rgba(232, 213, 196, 0.6)`

## Co-Design Attribution (REQUIRED)

Every design MUST include the kiquetal ribbon at the bottom.

**CSS:**
```css
.kiquetal-ribbon {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #f5f5f5;
    text-align: center;
    padding: 8px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    letter-spacing: 0.15em;
    border-top: 1px solid #444;
    opacity: 0.85;
    z-index: 9999;
}
.kiquetal-ribbon::before { content: '✦'; margin-right: 8px; color: #888; }
.kiquetal-ribbon::after { content: '✦'; margin-left: 8px; color: #888; }
```

**HTML (before `</body>`):**
```html
<div class="kiquetal-ribbon">co-designed by kiquetal</div>
```

## PNG Export

ALWAYS use `superdesign/screenshot.py` to generate PNG from HTML:

```bash
python superdesign/screenshot.py $(pwd)/superdesign/design_iterations/<design>.html <output_path>/<design>.png <width> <height>
```

Example:
```bash
python superdesign/screenshot.py $(pwd)/superdesign/design_iterations/aes-gcm-256-en.html public/blog/my-post/aes-gcm-256-en.png 800 1000
```

**Important:** 
- Use absolute path for HTML file: `$(pwd)/superdesign/design_iterations/<file>.html`
- The script captures the `.infographic` element if present, otherwise captures the full page
- Ensure the kiquetal ribbon is INSIDE the `.infographic` container so it appears in the screenshot
- Requires playwright: `pip install playwright && python -m playwright install chromium`

## Checklist
- [ ] Vintage color palette
- [ ] Serif fonts from approved list
- [ ] Paper texture overlay
- [ ] Ornamental borders/dividers
- [ ] Kiquetal ribbon at bottom
- [ ] PNG exported at exact size
- [ ] All text in sepia tones (except ribbon)
