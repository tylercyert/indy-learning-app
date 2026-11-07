/**
 * No-spend QA: home with the Discover section, starting a discovered course (clone), the course
 * screen with the companion panel open. Writes screenshots to QA_OUT (default qa/out/discover).
 *   npx tsx qa/discover.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const viewports = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1280, height: 900 } } as const;
const viewport = viewports[(process.env.QA_VIEWPORT ?? 'phone') as keyof typeof viewports] ?? viewports.phone;
const outDir = path.resolve(process.env.QA_OUT ?? 'qa/out/discover');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
let n = 0;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const shot = async (name: string) => {
    const file = path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`shot ${path.basename(file)}`);
  };

  await page.goto(base);
  await page.getByText('What do you want to learn?').first().waitFor({ timeout: 30_000 });
  await page.getByText(/Discover courses/).first().waitFor({ timeout: 30_000 }).catch(() => console.log('no discover section (no discoverable courses yet)'));
  await shot('home');

  const start = page.getByRole('button', { name: /start this course/i }).first();
  if ((await start.count()) === 0) {
    console.log('nothing to start; done');
    await browser.close();
    return;
  }
  await start.click();
  await page.waitForURL(/\/course\//, { timeout: 60_000 });
  await page.getByText(/Skill tree/).first().waitFor({ timeout: 30_000 });
  await shot('course-from-discovered');

  await page.getByRole('button', { name: /your companion\. Rename or get a new look/i }).first().click();
  await page.getByLabel('New companion name').waitFor({ timeout: 10_000 });
  await page.getByLabel('New companion name').fill('Nova');
  await shot('companion-panel');
  await page.getByRole('button', { name: /^rename$/i }).click();
  await page.getByText(/Nova · your guide/).first().waitFor({ timeout: 20_000 });
  await shot('companion-renamed');

  await browser.close();
  console.log(errors.length ? `${errors.length} console/page errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'no console or page errors');
}

main().catch((e) => {
  console.error('DISCOVER QA FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
