/**
 * Visual QA for the intake flow without model calls: the planning wait harness (/dev/planning) with
 * its rotating status lines, the same with reduce-motion, and the intake screen's warm first paint
 * (the API response is held back so the "thinking" state is visible).
 *
 *   QA_BASE_URL=http://127.0.0.1:8795 QA_OUT=qa/out/intake-fixtures \
 *   QA_TOKEN=<learner token> QA_INTAKE=<intake id> npx tsx qa/shot-intake.ts
 *
 * Prints the status line at each capture and the polite live-region text, so the rotation and the
 * "announce every other line" rule can be checked from the log as well as the PNGs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const outDir = path.resolve(process.env.QA_OUT ?? 'qa/out/intake-fixtures');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const viewport = { width: 390, height: 844 };
let n = 0;
const shot = async (page: Page, name: string) => {
  const file = path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`shot ${path.basename(file)}`);
};
const status = async (page: Page) => {
  const visible = await page.locator('[aria-hidden="true"]').filter({ hasText: /…$/ }).last().innerText().catch(() => '(none)');
  const live = await page.locator('[aria-live="polite"]').last().innerText().catch(() => '(none)');
  console.log(`  visible: "${visible}"   live region: "${live}"`);
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];

  // 1. Planning wait, fast interval so three lines fit in a few seconds.
  let ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  let page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/dev/planning?interval=1500`);
  await page.getByText('Mixing up your course').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(400);
  await shot(page, 'planning-line-1');
  await status(page);
  await page.waitForTimeout(1600);
  await shot(page, 'planning-line-2');
  await status(page);
  await page.waitForTimeout(1500);
  await shot(page, 'planning-line-3');
  await status(page);
  await page.goto(`${base}/dev/planning?tree=1&interval=1500`);
  await page.getByText('Adding a new skill tree').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1900);
  await shot(page, 'planning-tree-line-2');
  await status(page);
  await ctx.close();

  // 2. Same, with reduce-motion: beaker static, text swaps without a fade.
  ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/dev/planning?interval=1500`);
  await page.getByText('Mixing up your course').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1900);
  await shot(page, 'planning-reduced-motion-line-2');
  await status(page);
  await ctx.close();

  // 3. Intake first paint while the session is still loading.
  if (process.env.QA_TOKEN && process.env.QA_INTAKE) {
    ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.evaluate((token) => window.localStorage.setItem('indy.learnerToken', token), process.env.QA_TOKEN);
    await page.route('**/api/intakes/**', async (route) => {
      await new Promise((r) => setTimeout(r, 4000));
      await route.continue();
    });
    await page.goto(`${base}/intake/${process.env.QA_INTAKE}`);
    await page.getByText(/Give me a second/).waitFor({ timeout: 30_000 });
    await shot(page, 'intake-loading');
    await page.getByText(/Give me a second/).waitFor({ state: 'hidden', timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, 'intake-loaded');
    await ctx.close();
  }

  await browser.close();
  console.log(errors.length ? `${errors.length} errors:\n  ${[...new Set(errors)].join('\n  ')}` : 'no console or page errors');
}

main().catch((e) => {
  console.error('SHOT-INTAKE FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
