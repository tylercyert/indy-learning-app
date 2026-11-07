/**
 * Live QA of the exploration path: start a discovered course (clone, no spend) → "Learn something
 * different" → intake inside the course → "Add to my course" → a second skill tree appears.
 * Model spend: intake turns + one tree plan (+ prefetch of its first lesson).
 *   npx tsx qa/explore.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const outDir = path.resolve(process.env.QA_OUT ?? 'qa/out/explore');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
let n = 0;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const shot = async (name: string) => {
    const file = path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    log(`shot ${path.basename(file)}`);
  };

  await page.goto(base);
  await page.getByRole('button', { name: /start this course/i }).first().waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: /start this course/i }).first().click();
  await page.waitForURL(/\/course\//, { timeout: 60_000 });
  await page.getByText(/Skill tree 1/).first().waitFor({ timeout: 30_000 });
  await shot('course');

  await page.getByRole('button', { name: /learn something different/i }).click();
  await page.waitForURL(/\/intake\//, { timeout: 60_000 });
  for (let turn = 1; turn <= 6; turn++) {
    const build = page.getByRole('button', { name: /add to my course/i });
    const chip = page.getByTestId('intake-chip');
    await Promise.race([build.first().waitFor({ timeout: 60_000 }), chip.first().waitFor({ timeout: 60_000 })]);
    await shot(`explore-intake-${turn}`);
    if ((await build.count()) > 0) {
      await build.first().click();
      break;
    }
    log(`answering with chip "${await chip.first().innerText()}"`);
    await chip.first().click();
    await page.getByText('…', { exact: true }).first().waitFor({ timeout: 10_000 }).catch(() => undefined);
    await page.getByText('…', { exact: true }).first().waitFor({ state: 'hidden', timeout: 90_000 });
  }
  await page.waitForTimeout(1200);
  await shot('explore-planning');
  await page.waitForURL(/\/course\//, { timeout: 240_000 });
  log(`course url: ${page.url()}`);
  try {
    await page.getByText(/Skill tree\s*2/).first().waitFor({ timeout: 60_000 });
  } catch (e) {
    await shot('course-after-explore-unexpected');
    log(`body text sample: ${(await page.locator('body').innerText()).slice(0, 400).replace(/\n+/g, ' | ')}`);
    throw e;
  }
  await shot('course-with-tree-2');
  await browser.close();
  log(errors.length ? `${errors.length} console/page errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'no console or page errors');
  log('EXPLORE OK');
}

main().catch((e) => {
  console.error('EXPLORE FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
