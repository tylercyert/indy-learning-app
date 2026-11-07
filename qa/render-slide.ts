/**
 * Renders slide fixtures through the /dev/slide harness and screenshots them. No model calls.
 *
 *   npx tsx qa/render-slide.ts qa/fixtures/*.json                # phone viewport → qa/out/slides/
 *   QA_VIEWPORT=tablet QA_OUT=qa/out/slides-tablet npx tsx qa/render-slide.ts qa/fixtures/diagram-*.json
 *
 * Each fixture is a SlideV1 JSON document. The harness shows validation errors in place of the slide,
 * so a fixture that fails the contract still produces a readable screenshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const viewports = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1280, height: 900 } } as const;
const viewport = viewports[(process.env.QA_VIEWPORT ?? 'phone') as keyof typeof viewports] ?? viewports.phone;
const outDir = path.resolve(process.env.QA_OUT ?? 'qa/out/slides');
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: tsx qa/render-slide.ts <fixture.json> [...]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));

  for (const file of files) {
    const json = fs.readFileSync(file, 'utf8');
    const url = `${base}/dev/slide?doc=${encodeURIComponent(JSON.stringify(JSON.parse(json)))}`;
    await page.goto(url);
    await page.getByText('QA HARNESS').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const out = path.join(outDir, `${path.basename(file, '.json')}.png`);
    await page.screenshot({ path: out, fullPage: true });
    const invalid = (await page.getByText('Slide did not validate').count()) > 0;
    console.log(`${invalid ? 'INVALID ' : 'rendered'} ${path.basename(file)} → ${out}`);
  }
  await browser.close();
  if (errors.length) {
    console.log(`${errors.length} console/page errors:`);
    for (const e of [...new Set(errors)].slice(0, 10)) console.log('  ' + e);
  }
}

main().catch((e) => {
  console.error('RENDER FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
