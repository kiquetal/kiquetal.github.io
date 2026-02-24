import sys
from playwright.sync_api import sync_playwright
from PIL import Image
import io

html_file = sys.argv[1]
output_file = sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 800
height = int(sys.argv[4]) if len(sys.argv) > 4 else 600

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': width, 'height': height})
    page.goto(f'file://{html_file}')
    page.wait_for_load_state('networkidle')
    screenshot_bytes = page.screenshot(full_page=False)
    browser.close()
    
    img = Image.open(io.BytesIO(screenshot_bytes))
    img = img.crop((0, 0, width, height))
    img.save(output_file)
    print(f'Saved: {output_file} ({width}x{height}px)')
