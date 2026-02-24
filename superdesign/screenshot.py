#!/usr/bin/env python3
import sys
from playwright.sync_api import sync_playwright

def screenshot(html_path, output_path, width=500, height=600):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.goto(f'file://{html_path}')
        page.wait_for_timeout(1500)
        
        element = page.query_selector('.infographic')
        if element:
            element.screenshot(path=output_path)
        else:
            page.screenshot(path=output_path)
        
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
