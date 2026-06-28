#!/usr/bin/env python3
import os
import sys
import json
import argparse
from playwright.sync_api import sync_playwright

TEMPLATE = """<!DOCTYPE html>
<html lang="{lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Crimson+Text:wght@400;600&family=Architects+Daughter&family=Caveat:wght@400;700&display=swap" rel="stylesheet">
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            background: #F5E6D3;
            font-family: 'Crimson Text', serif;
            padding: 40px 20px;
            position: relative;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }}
        
        .infographic {{
            max-width: {width}px;
            width: 100%;
            margin: 0 auto;
            background: linear-gradient(135deg, #F5E6D3 0%, #E8D5C4 50%, #D2B48C 100%);
            border: 6px solid #8B7355;
            border-radius: 4px;
            padding: 32px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            position: relative;
            background-image: 
                repeating-linear-gradient(0deg, rgba(139, 115, 85, 0.03) 0px, transparent 1px, transparent 2px, rgba(139, 115, 85, 0.03) 3px),
                repeating-linear-gradient(90deg, rgba(139, 115, 85, 0.03) 0px, transparent 1px, transparent 2px, rgba(139, 115, 85, 0.03) 3px);
        }}
        
        h1 {{
            font-family: 'Playfair Display', serif;
            font-size: 38px;
            color: #5C4A3A;
            text-align: center;
            letter-spacing: 0.08em;
            margin-bottom: 8px;
            line-height: 1.2;
            text-transform: uppercase;
        }}
        
        .subtitle {{
            font-size: 18px;
            color: #8B7355;
            text-align: center;
            letter-spacing: 0.08em;
            margin-bottom: 24px;
            font-style: italic;
        }}
        
        .divider {{
            text-align: center;
            color: #8B7355;
            font-size: 20px;
            margin: 20px 0;
            letter-spacing: 0.5em;
        }}
        
        /* Sections layout */
        .sections-list {{
            display: flex;
            flex-direction: column;
            gap: 16px;
        }}
        
        .section {{
            background: rgba(232, 213, 196, 0.6);
            border: 3px solid #8B7355;
            border-radius: 3px;
            padding: 20px;
            position: relative;
        }}
        
        .section h2 {{
            font-family: 'Playfair Display', serif;
            font-size: 22px;
            color: #5C4A3A;
            letter-spacing: 0.08em;
            margin-bottom: 12px;
            border-bottom: 2px solid #8B7355;
            padding-bottom: 8px;
        }}
        
        .section p, .section ul {{
            font-size: 15px;
            line-height: 1.6;
            color: #5C4A3A;
        }}
        
        .section ul {{
            list-style: none;
            padding-left: 0;
        }}
        
        .section li {{
            padding-left: 20px;
            position: relative;
            margin-bottom: 6px;
        }}
        
        .section li::before {{
            content: '✦';
            position: absolute;
            left: 0;
            color: #8B7355;
        }}
        
        /* Grid layout */
        .methods-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-top: 16px;
        }}
        
        .method {{
            background: rgba(232, 213, 196, 0.6);
            border: 3px solid #8B7355;
            border-radius: 2px;
            padding: 20px;
        }}
        
        .method-title {{
            font-family: 'Playfair Display', serif;
            font-size: 24px;
            color: #5C4A3A;
            margin-bottom: 14px;
            letter-spacing: 0.05em;
            text-align: center;
            border-bottom: 2px solid #8B7355;
            padding-bottom: 10px;
        }}
        
        .method-content {{
            font-size: 15px;
            color: #5C4A3A;
            line-height: 1.7;
        }}
        
        .endpoint {{
            background: rgba(92, 74, 58, 0.1);
            border-left: 4px solid #8B7355;
            padding: 10px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            font-weight: 600;
            word-break: break-all;
        }}
        
        .feature {{
            margin: 8px 0;
            padding-left: 16px;
            position: relative;
        }}
        
        .feature::before {{
            content: '✦';
            position: absolute;
            left: 0;
            color: #8B7355;
        }}
        
        /* Flow diagram */
        .flow-diagram {{
            background: rgba(245, 230, 211, 0.8);
            border: 2px solid #8B7355;
            padding: 20px;
            margin: 24px 0 0px 0;
            text-align: center;
            border-radius: 3px;
        }}
        
        .flow-step {{
            display: inline-block;
            background: #D2B48C;
            color: #5C4A3A;
            padding: 8px 14px;
            margin: 4px;
            border: 2px solid #8B7355;
            border-radius: 3px;
            font-weight: 600;
            font-size: 13px;
            line-height: 1.3;
        }}
        
        .arrow {{
            display: inline-block;
            color: #8B7355;
            font-size: 18px;
            margin: 0 6px;
            vertical-align: middle;
        }}
        
        /* Ribbon */
        .kiquetal-ribbon {{
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
        }}
        
        .kiquetal-ribbon::before {{
            content: '✦';
            margin-right: 8px;
            color: #888;
        }}
        
        .kiquetal-ribbon::after {{
            content: '✦';
            margin-left: 8px;
            color: #888;
        }}

        /* Excalidraw Sketchy Style Overrides */
        .excalidraw-container {{
            font-family: 'Architects Daughter', 'Caveat', cursive, sans-serif !important;
        }}
        
        .excalidraw-container h1, 
        .excalidraw-container h2, 
        .excalidraw-container .subtitle,
        .excalidraw-container .flow-step,
        .excalidraw-container .method-title {{
            font-family: 'Architects Daughter', 'Caveat', cursive, sans-serif !important;
            text-transform: none !important;
            letter-spacing: 0.05em !important;
        }}

        .excalidraw-container .infographic {{
            border: 4px solid #8B7355 !important;
            border-radius: 20px 10px 20px 10px / 10px 20px 10px 20px !important;
            filter: url(#hand-drawn) !important;
        }}

        .excalidraw-container .section {{
            border: 3px solid #8B7355 !important;
            border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px !important;
            filter: url(#hand-drawn) !important;
            transform: rotate(-0.5deg);
        }}
        
        .excalidraw-container .section:nth-child(even) {{
            transform: rotate(0.6deg);
        }}

        .excalidraw-container .method {{
            border: 3px solid #8B7355 !important;
            border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px !important;
            filter: url(#hand-drawn) !important;
            transform: rotate(0.4deg);
        }}
        
        .excalidraw-container .method:nth-child(even) {{
            transform: rotate(-0.5deg);
        }}

        .excalidraw-container .flow-step {{
            background: rgba(210, 180, 140, 0.4) !important;
            border: 2px dashed #8B7355 !important;
            border-radius: 120px 20px 100px 20px / 20px 100px 20px 120px !important;
            filter: url(#hand-drawn) !important;
            transform: rotate(0.8deg);
        }}
        
        .excalidraw-container .flow-step:nth-child(even) {{
            transform: rotate(-0.6deg);
        }}

        .excalidraw-container .arrow {{
            font-size: 24px !important;
            font-weight: bold !important;
            color: #8B7355 !important;
            display: inline-block !important;
            transform: scaleX(1.3) translateY(2px) !important;
        }}

        /* Blueprint Style Overrides */
        .blueprint-container {{
            background: #0f1c3f !important;
        }}
        
        .blueprint-container .infographic {{
            background: linear-gradient(135deg, #0d1e3d 0%, #152a55 50%, #1d366d 100%) !important;
            border-color: #aed3ff !important;
            background-image: 
                repeating-linear-gradient(0deg, rgba(174, 211, 255, 0.04) 0px, transparent 1px, transparent 2px, rgba(174, 211, 255, 0.04) 3px),
                repeating-linear-gradient(90deg, rgba(174, 211, 255, 0.04) 0px, transparent 1px, transparent 2px, rgba(174, 211, 255, 0.04) 3px) !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important;
        }}
        
        .blueprint-container h1 {{
            color: #ffffff !important;
            text-shadow: 0 0 10px rgba(255,255,255,0.3) !important;
        }}
        
        .blueprint-container .subtitle {{
            color: #aed3ff !important;
        }}
        
        .blueprint-container .divider {{
            color: #7baaff !important;
        }}
        
        .blueprint-container .section {{
            background: rgba(13, 30, 61, 0.65) !important;
            border-color: #7baaff !important;
        }}
        
        .blueprint-container .section h2 {{
            color: #ffffff !important;
            border-bottom-color: #7baaff !important;
        }}
        
        .blueprint-container .section p, 
        .blueprint-container .section ul {{
            color: #e2f0ff !important;
        }}
        
        .blueprint-container .section li::before {{
            color: #7baaff !important;
        }}
        
        .blueprint-container .method {{
            background: rgba(13, 30, 61, 0.65) !important;
            border-color: #7baaff !important;
        }}
        
        .blueprint-container .method-title {{
            color: #ffffff !important;
            border-bottom-color: #7baaff !important;
        }}
        
        .blueprint-container .method-content {{
            color: #e2f0ff !important;
        }}
        
        .blueprint-container .endpoint {{
            background: rgba(255, 255, 255, 0.08) !important;
            border-left-color: #7baaff !important;
            color: #ffffff !important;
        }}
        
        .blueprint-container .feature::before {{
            color: #7baaff !important;
        }}
        
        .blueprint-container .flow-diagram {{
            background: rgba(15, 28, 63, 0.8) !important;
            border-color: #7baaff !important;
        }}
        
        .blueprint-container .flow-step {{
            background: rgba(21, 42, 85, 0.8) !important;
            color: #ffffff !important;
            border-color: #7baaff !important;
        }}
        
        .blueprint-container .arrow {{
            color: #7baaff !important;
        }}

        .blueprint-container .kiquetal-ribbon {{
            border-top: 1px solid #1d366d !important;
            background: linear-gradient(135deg, #0d1e3d 0%, #152a55 100%) !important;
            color: #aed3ff !important;
            opacity: 0.95 !important;
        }}

        /* Override Excalidraw colors if inside Blueprint */
        .blueprint-container.excalidraw-container .infographic {{
            border: 4px solid #aed3ff !important;
        }}
        .blueprint-container.excalidraw-container .section {{
            border: 3px solid #7baaff !important;
        }}
        .blueprint-container.excalidraw-container .method {{
            border: 3px solid #7baaff !important;
        }}
        .blueprint-container.excalidraw-container .flow-step {{
            border: 2px dashed #7baaff !important;
            background: rgba(21, 42, 85, 0.5) !important;
        }}

        /* Vertical Flow Layout Styles */
        .vertical-flow .flow-step {{
            display: block !important;
            margin: 12px auto !important;
            max-width: 400px !important;
            text-align: center !important;
        }}
        
        .vertical-flow .arrow {{
            display: block !important;
            margin: 10px auto !important;
            font-size: 26px !important;
            transform: scaleY(1.4) !important;
        }}

        .blueprint-container .vertical-flow .arrow {{
            color: #7baaff !important;
        }}
    </style>
</head>
<body class="{body_class}">
    <div class="infographic">
        <h1>{title_html}</h1>
        {subtitle_html}
        
        <div class="divider">✦ ❦ ✦</div>
        
        {content_html}
        
        {flow_html}
        
        <div style="margin-bottom: 30px;"></div>
        <div class="kiquetal-ribbon">co-designed by kiquetal</div>
    </div>

    <!-- SVG Filter for Hand-Drawn Sketch (Excalidraw) Effect -->
    <svg style="position: absolute; width: 0; height: 0;" xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
            <filter id="hand-drawn">
                <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </defs>
    </svg>
</body>
</html>
"""

def resolve_field(field, lang):
    if isinstance(field, dict):
        return field.get(lang, field.get('en', ''))
    return str(field)

def compile_diagram(data, lang):
    title = resolve_field(data.get('title', ''), lang)
    subtitle = resolve_field(data.get('subtitle', ''), lang)
    layout = data.get('layout', 'sections')
    width = data.get('width', 800)
    
    is_blueprint = data.get('style') == 'blueprint' or data.get('blueprint', False)
    is_excalidraw = data.get('style') == 'excalidraw' or data.get('excalidraw', False) or is_blueprint
    
    classes = []
    if is_excalidraw:
        classes.append("excalidraw-container")
    if is_blueprint:
        classes.append("blueprint-container")
    body_class = " ".join(classes)
    
    title_html = title.replace('\n', '<br>')
    
    if subtitle:
        subtitle_html = f'<p class="subtitle">{subtitle}</p>'
    else:
        subtitle_html = ''
        
    content_html = ""
    if layout == "grid":
        grid_items = data.get('grid', [])
        content_html += '<div class="methods-grid">\n'
        for item in grid_items:
            item_title = resolve_field(item.get('title', ''), lang)
            item_endpoint = resolve_field(item.get('endpoint', ''), lang)
            
            points_list = item.get('points', [])
            if isinstance(points_list, dict):
                points_list = points_list.get(lang, points_list.get('en', []))
                
            content_html += '    <div class="method">\n'
            content_html += f'        <div class="method-title">{item_title}</div>\n'
            content_html += '        <div class="method-content">\n'
            if item_endpoint:
                content_html += f'            <div class="endpoint">{item_endpoint}</div>\n'
            for pt in points_list:
                pt_resolved = resolve_field(pt, lang)
                content_html += f'            <div class="feature">{pt_resolved}</div>\n'
            content_html += '        </div>\n'
            content_html += '    </div>\n'
        content_html += '</div>\n'
    else:  # default is "sections"
        sections = data.get('sections', [])
        content_html += '<div class="sections-list">\n'
        for sec in sections:
            sec_title = resolve_field(sec.get('title', ''), lang)
            points_list = sec.get('points', [])
            if isinstance(points_list, dict):
                points_list = points_list.get(lang, points_list.get('en', []))
                
            content_html += '    <div class="section">\n'
            content_html += f'        <h2>{sec_title}</h2>\n'
            content_html += '        <ul>\n'
            for pt in points_list:
                pt_resolved = resolve_field(pt, lang)
                content_html += f'            <li>{pt_resolved}</li>\n'
            content_html += '        </ul>\n'
            content_html += '    </div>\n'
        content_html += '</div>\n'
        
    flow_html = ""
    flow_data = data.get('flow')
    if flow_data:
        flow_title = resolve_field(flow_data.get('title', 'Workflow'), lang)
        steps_list = flow_data.get('steps', [])
        if isinstance(steps_list, dict):
            steps_list = steps_list.get(lang, steps_list.get('en', []))
            
        flow_direction = flow_data.get('direction', 'horizontal')
        is_vertical = flow_direction == 'vertical'
        flow_class = "vertical-flow" if is_vertical else ""
            
        flow_html += f'<div class="flow-diagram {flow_class}">\n'
        flow_html += f'    <div style="margin-bottom: 12px; font-family: \'Playfair Display\', serif; color: #5C4A3A; font-size: 18px; letter-spacing: 0.08em;">{flow_title}</div>\n'
        flow_html += '    <div>\n'
        
        for i, step in enumerate(steps_list):
            step_resolved = resolve_field(step, lang).replace('\n', '<br>')
            if i > 0:
                arrow_char = "↓" if is_vertical else "→"
                flow_html += f'        <span class="arrow">{arrow_char}</span>\n'
            flow_html += f'        <span class="flow-step">{step_resolved}</span>\n'
            
        flow_html += '    </div>\n'
        flow_html += '</div>\n'
        
    return TEMPLATE.format(
        lang=lang,
        title=title,
        width=width,
        title_html=title_html,
        subtitle_html=subtitle_html,
        content_html=content_html,
        flow_html=flow_html,
        body_class=body_class
    )

def main():
    parser = argparse.ArgumentParser(description="Generate kiquetal-styled infographic HTML and PNG from JSON.")
    parser.add_argument("config_file", help="Path to the JSON diagram configuration file.")
    parser.add_argument("--out-dir", default=None, help="Directory to save output files. Defaults to same dir as config.")
    parser.add_argument("--width", type=int, default=None, help="Force diagram viewport width.")
    parser.add_argument("--height", type=int, default=None, help="Force diagram viewport height limit.")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.config_file):
        print(f"Error: Config file not found at {args.config_file}")
        sys.exit(1)
        
    try:
        with open(args.config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON config: {e}")
        sys.exit(1)
        
    # Check if width is overridden in args or in JSON
    if args.width:
        data['width'] = args.width
    elif 'width' not in data:
        data['width'] = 800 if data.get('layout') == 'sections' else 900
        
    out_dir = args.out_dir if args.out_dir else os.path.dirname(os.path.abspath(args.config_file))
    os.makedirs(out_dir, exist_ok=True)
    
    # Determine languages to generate
    # If any top-level text field has 'en' and 'es', we generate both.
    languages = ['en']
    if isinstance(data.get('title'), dict) and 'es' in data['title']:
        languages = ['en', 'es']
    elif isinstance(data.get('subtitle'), dict) and 'es' in data['subtitle']:
        languages = ['en', 'es']
        
    base_name = os.path.splitext(os.path.basename(args.config_file))[0]
    
    print(f"Generating diagram(s) for languages: {languages}")
    
    generated_html_files = []
    
    for lang in languages:
        html_content = compile_diagram(data, lang)
        
        # Build file names
        suffix = f"-{lang}" if len(languages) > 1 or lang == 'es' else ""
        html_file = os.path.join(out_dir, f"{base_name}{suffix}.html")
        png_file = os.path.join(out_dir, f"{base_name}{suffix}.png")
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        print(f"Saved HTML template: {html_file}")
        generated_html_files.append((html_file, png_file))
        
    # Perform Playwright rendering
    print("Compiling pixel-perfect PNG screenshots using Playwright...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for html_file, png_file in generated_html_files:
                # Use a wider viewport to prevent wrapping, we query the exact element size
                page = browser.new_page(viewport={'width': data['width'] + 100, 'height': args.height or 1200})
                page.goto(f"file://{os.path.abspath(html_file)}")
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(500) # fonts
                
                element = page.query_selector('.infographic')
                if element:
                    element.screenshot(path=png_file)
                else:
                    page.screenshot(path=png_file)
                print(f"Generated pixel-perfect PNG: {png_file}")
            browser.close()
        print("Successfully generated all diagrams!")
    except Exception as e:
        print(f"Error during PNG screenshot generation: {e}")
        print("Ensure Playwright is installed: pip install playwright && playwright install chromium")
        sys.exit(1)

if __name__ == "__main__":
    main()
