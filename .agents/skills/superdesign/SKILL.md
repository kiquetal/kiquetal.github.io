---
name: superdesign
description: Ensure all diagrams, flowcharts, and infographics follow kiquetal's "superdesign" vintage style guidelines, utilizing the automated generator or Playwright screenshot script.
---

# Kiquetal Superdesign Diagram Skill

This skill enforces a consistent, professional, and beautiful vintage style for all diagrams and infographics generated for kiquetal's personal blog.

## The Style System

All generated infographics must strictly adhere to the following visual aesthetic:

### 1. Color Palette (Sepia Theme)
*   **Background**: Warm, nostalgic sepia gradients.
    *   Body: `background: #F5E6D3;` or `linear-gradient(135deg, #F5E6D3 0%, #E8D5C4 100%);`
    *   Card Background: `rgba(232, 213, 196, 0.6)`
    *   Inner Flow Steps: `#D2B48C` (beige/tan)
*   **Typography & Colors**:
    *   Primary Text / Headers: `#5C4A3A` (dark brown)
    *   Secondary Text / Accent: `#8B7355` (medium brown)
    *   Monospace Font: `Courier New` for technical endpoints or code
*   **Borders**: Solid dark/medium brown (`#8B7355`), usually 3px to 8px.

### 2. Typography
*   **Headings**: `'Playfair Display'`, serif, bold, uppercase or high letter-spacing.
*   **Body**: `'Crimson Text'`, serif, regular.

### 3. Decorative Details
*   **Texture**: Subtle repeating linear-gradients on background to mimic paper grid lines.
*   **Dividers**: Standardized ornament divider `✦ ❦ ✦` or `✦`.
*   **List Icons**: Bullet points should always be preceded by a small diamond `✦`.

### 4. Co-Design Ribbon (MANDATORY)
Every infographic must feature the bottom ribbon:
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
```
And the corresponding HTML:
```html
<div class="kiquetal-ribbon">co-designed by kiquetal</div>
```

---

## Programmatic Generation

To guarantee absolute consistency and eliminate human/AI styling errors, use the **Superdesign Diagram Generator Utility** located at `superdesign/generator.py`.

### How to use the Generator

1.  **Define the content in JSON format** (e.g., `diagram.json`). Use bilingual keys (`en` and `es`) to generate both versions automatically:
    ```json
    {
      "title": {
        "en": "AES-GCM-256",
        "es": "AES-GCM-256"
      },
      "subtitle": {
        "en": "Advanced Encryption",
        "es": "Encriptación Avanzada"
      },
      "layout": "sections",
      "sections": [
        {
          "title": {
            "en": "Initialization Vector (IV)",
            "es": "Vector de Inicialización (IV)"
          },
          "points": {
            "en": [
              "96-bit (12 bytes) random value",
              "Never reuse with the same key"
            ],
            "es": [
              "Valor aleatorio de 96 bits (12 bytes)",
              "Nunca reutilizar con la misma clave"
            ]
          }
        }
      ],
      "flow": {
        "title": {
          "en": "Encryption Flow",
          "es": "Flujo de Encriptación"
        },
        "steps": ["Password", "PBKDF2", "AES-GCM"]
      }
    }
    ```

2.  **Run the generator**:
    ```bash
    python3 superdesign/generator.py path/to/diagram.json --out-dir public/blog/your-post-slug/
    ```

This will automatically produce:
*   `public/blog/your-post-slug/diagram-en.html` and `diagram-en.png`
*   `public/blog/your-post-slug/diagram-es.html` and `diagram-es.png`

Always prefer the generator script over writing manual raw HTML to maintain strict design standards.
