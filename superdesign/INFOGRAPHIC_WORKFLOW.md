# Infographic Generation Workflow

## Quick Command

To generate a blog-ready infographic PNG from HTML:

```bash
python3 /tmp/screenshot_exact.py "/path/to/your/infographic.html" "/path/to/output.png"
```

## Design Guidelines

### HTML Structure
- **Size**: 400px width, 450-750px height (adjust based on content)
- **Background**: Nostalgic sepia gradient
  ```css
  background: linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 50%, #d4c4a8 100%);
  ```
- **Texture**: Vintage paper effect with subtle grid pattern
- **Layout**: 2-column grid for balanced information display

### Color Palette (Sepia Theme)
- Primary text: `#3d2f1f` (dark brown)
- Secondary text: `#5c4a3a` (medium brown)
- Accent: `#8b7355` (warm brown)
- Backgrounds: `#f5f0e8`, `#fdfbf7` (cream/beige)
- Borders: `#d4c4a8` (tan)
- Decorative: `#c9b896`, `#a89378` (light browns)

### Ribbon (Co-design Credit)
```html
<div class="ribbon">co-designed by kiquetal</div>
```
- Position: Bottom center
- Style: Folded ribbon with triangular edges
- Colors: Gradient `#8b7355` to `#6b5744`

## Complete Workflow

1. **Create HTML** at exact dimensions (e.g., `infographic_400x450.html`)
2. **Generate PNG** using Playwright script:
   ```bash
   python3 /tmp/screenshot_exact.py "$(pwd)/infographic_400x450.html" "$(pwd)/output.png"
   ```
3. **Result**: Pixel-perfect PNG with no cropping issues

## Template Structure

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            width: 400px;
            height: 450px; /* adjust as needed */
            background: linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 50%, #d4c4a8 100%);
        }
        /* Add vintage texture and ribbon styles */
    </style>
</head>
<body>
    <div class="p-6">
        <h1>Title</h1>
        <div class="grid grid-cols-2 gap-4">
            <!-- 2 columns of content -->
        </div>
        <div class="ribbon">co-designed by kiquetal</div>
    </div>
</body>
</html>
```

## Key Points

- ✅ Design HTML at target size (no resizing needed)
- ✅ Use Playwright script for exact content capture
- ✅ Nostalgic sepia colors + vintage texture
- ✅ Ribbon for co-design credit
- ✅ 2-column layout for clarity
- ✅ No white space cropping issues
