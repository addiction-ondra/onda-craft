// Vygeneruje PNG ikony z public/icons/favicon.svg pomocí Playwright (Chromium).
// Spuštění: npm run icons
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/icons/favicon.svg'), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, pad: 0, bg: 'transparent' },
  { file: 'icon-512-maskable.png', size: 512, pad: 0.12, bg: '#7cc8f0' },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, bg: '#7cc8f0' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * t.pad));
  // apple-touch-icon a maskable: bez průhledných rohů (iOS si je zaoblí sám)
  const body = t.bg === 'transparent' ? svg : svg.replace('rx="112"', 'rx="0"');
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${t.bg};display:grid;place-items:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${body.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: join(root, 'public/icons', t.file), omitBackground: t.bg === 'transparent' });
  console.log('✓', t.file);
}
await browser.close();
