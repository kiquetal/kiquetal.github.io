# Designer Agent Infographics — Steering

## Purpose
Style and process rules for the infographic designer agent. All infographics must follow the kiquetal vintage design system.

## Vintage Style (Mandatory)

### Colors
| Token | Hex |
|-------|-----|
| Cream | `#F5E6D3` |
| Tan | `#E8D5C4` |
| Beige | `#D2B48C` |
| Brown | `#8B7355` |
| Dark Brown | `#5C4A3A` |

Background: warm sepia gradients. No pure black except in the kiquetal ribbon.

### Typography
- Headings: Playfair Display / Libre Baskerville / Cormorant Garamond — serif, bold, 36-48px, letter-spacing 0.05-0.15em
- Body: Crimson Text / Lora / EB Garamond — serif, 14-16px

### Visual Elements
- Borders: 2-8px solid `#8B7355`
- Paper texture: repeating linear gradients at 3% opacity
- Box shadows: `0 8px 24px rgba(0,0,0,0.3)`
- Rounded corners: 2-4px max
- Ornamental dividers: ✦, ❦, horizontal lines

### Layout
- Padding: 24-32px
- Element spacing: 12-16px
- Semi-transparent backgrounds: `rgba(232, 213, 196, 0.6)`

## Kiquetal Ribbon (Required on every design)

Must be inside the `.infographic` container so it appears in screenshots.

```html
<div class="kiquetal-ribbon">co-designed by kiquetal</div>
```

```css
.kiquetal-ribbon {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #f5f5f5; text-align: center; padding: 8px;
    font-family: 'Courier New', monospace; font-size: 11px;
    letter-spacing: 0.15em; border-top: 1px solid #444;
    opacity: 0.85; z-index: 9999;
}
.kiquetal-ribbon::before { content: '✦'; margin-right: 8px; color: #888; }
.kiquetal-ribbon::after { content: '✦'; margin-left: 8px; color: #888; }
```

## PNG Export Process

```bash
python superdesign/screenshot.py $(pwd)/superdesign/design_iterations/<design>.html public/blog/<blog-slug>/<design>.png <width> <height>
```

- Use absolute path for HTML (`$(pwd)/...`)
- Script captures `.infographic` element if present, otherwise full page
- Typical sizes: 500×600, 800×1000 — adjust to content

## File Naming
- Pattern: `<topic>-<lang>.html` (e.g., `istio-virtualservice-policy-en.html`)
- Supported languages: `en`, `es`

## Prompt Engineering for superdesign_generate
When calling `superdesign_generate`, always include in the prompt:
- Exact dimensions (width × height)
- The vintage color palette hex values
- Serif font families
- Paper texture requirement
- Kiquetal ribbon requirement
- The specific technical content to visualize

## Checklist (before delivering)
- [ ] Vintage color palette applied
- [ ] Serif fonts from approved list
- [ ] Paper texture overlay present
- [ ] Ornamental borders/dividers
- [ ] Kiquetal ribbon inside `.infographic` container
- [ ] PNG exported at correct dimensions
- [ ] All text in sepia/brown tones (no pure black except ribbon)
- [ ] File saved in `superdesign/design_iterations/`
- [ ] PNG placed in `public/blog/<blog-slug>/`
