# Kiquetal Design Steering Guide

## Vintage Style Guidelines

### Color Palette
- Primary: `#F5E6D3` (cream), `#E8D5C4` (tan), `#D2B48C` (beige)
- Accent: `#8B7355` (brown), `#5C4A3A` (dark brown)
- Background: Warm sepia tones, gradients from light to medium brown

### Typography
- Headings: `'Playfair Display'`, `'Libre Baskerville'`, `'Cormorant Garamond'` (serif, bold)
- Body: `'Crimson Text'`, `'Lora'`, `'EB Garamond'` (serif, regular)
- Size: H1: 36-48px, H2: 24-32px, Body: 14-16px
- Letter-spacing: 0.05-0.15em for headings

### Visual Elements
- Borders: 2-8px solid `#8B7355`, double borders for ornate look
- Paper texture: Subtle repeating linear gradients with low opacity
- Shadows: `box-shadow: 0 8px 24px rgba(0,0,0,0.3)` for depth
- Rounded corners: 2-4px (minimal, not modern)
- Dividers: Horizontal lines, ornamental symbols (✦, ❦, decorative dashes)

### Layout
- Padding: 24-32px for main containers
- Spacing: 12-16px between elements
- Backgrounds: Semi-transparent overlays `rgba(232, 213, 196, 0.6)`
- Border style: Solid, double, or decorative corners

## Kiquetal Ribbon Style (REQUIRED)

**Always include this CSS:**
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
    text-transform: lowercase;
    border-top: 1px solid #444;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    opacity: 0.85;
}

.kiquetal-ribbon::before {
    content: '✦';
    margin-right: 8px;
    color: #888;
}

.kiquetal-ribbon::after {
    content: '✦';
    margin-left: 8px;
    color: #888;
}
```

**Always include this HTML (before `</body>`):**
```html
<div class="kiquetal-ribbon">co-designed by kiquetal</div>
```

## PNG Generation with Python Playwright

### Installation
```bash
pip install playwright
playwright install chromium
```

### Screenshot Script
Create `screenshot.py`:
```python
#!/usr/bin/env python3
import sys
from playwright.sync_api import sync_playwright

def screenshot(html_path, output_path, width=500, height=600):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.goto(f'file://{html_path}')
        page.wait_for_timeout(1000)  # Wait for fonts
        page.screenshot(path=output_path, full_page=False)
        browser.close()
        print(f'Screenshot saved: {output_path}')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python screenshot.py <html_file> <output_png> [width] [height]')
        sys.exit(1)
    
    html_file = sys.argv[1]
    output_file = sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 500
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 600
    
    screenshot(html_file, output_file, width, height)
```

### Usage
```bash
python screenshot.py /path/to/design.html /path/to/output.png [width] [height]
```

### Example for 500x600px infographic:
```bash
python screenshot.py \
  /mydata/codes/2026/kiquetal.github.io/superdesign/design_iterations/udp_tcp_vintage.html \
  /mydata/codes/2026/kiquetal.github.io/superdesign/design_iterations/udp_tcp_vintage.png \
  500 600
```

## Design Checklist
- [ ] Vintage color palette applied
- [ ] Serif fonts from approved list
- [ ] Paper texture overlay
- [ ] Ornamental borders/dividers
- [ ] Kiquetal ribbon at bottom
- [ ] PNG generated at exact dimensions
- [ ] All text in sepia/brown tones (no pure black except ribbon)
