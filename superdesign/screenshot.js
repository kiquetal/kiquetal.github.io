import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 500, height: 600 });
await page.goto('file://' + process.argv[2]);
await page.waitForTimeout(1000);
await page.screenshot({ path: process.argv[3], fullPage: false });
await browser.close();

console.log('Screenshot saved:', process.argv[3]);
