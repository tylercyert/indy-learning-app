/**
 * Visual QA driver: plays the learner journey in headless Chromium against a running server and
 * writes a screenshot per step, plus console errors. Real model calls, real spend.
 *
 *   npx tsx qa/journey.ts ["goal text"]            # full journey: home → intake → course → lesson → celebration
 *   QA_BASE_URL=http://127.0.0.1:8787 QA_VIEWPORT=phone|tablet|desktop QA_OUT=qa/out/run-a npx tsx qa/journey.ts
 *   QA_TOKEN=<learner token> QA_COURSE=<course id> npx tsx qa/journey.ts   # skip intake; open an existing course
 *
 * Several runs can go in parallel if each sets its own QA_OUT. Read the PNGs afterwards to see what
 * the learner sees. The run never asserts design; it reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const goal = process.argv[2] ?? 'I want to make great cocktails for a party on Saturday, including a good non-alcoholic option';
const viewports = { phone: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, desktop: { width: 1280, height: 900 } } as const;
const viewportName = (process.env.QA_VIEWPORT ?? 'phone') as keyof typeof viewports;
const viewport = viewports[viewportName] ?? viewports.phone;
const outDir = path.resolve(process.env.QA_OUT ?? 'qa/out');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let shotIndex = 0;
const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
const errors: string[] = [];

async function shot(page: Page, name: string) {
  const file = path.join(outDir, `${String(++shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`shot ${path.basename(file)}`);
}

async function answerSlide(page: Page): Promise<'answered' | 'none'> {
  const radios = page.getByRole('radio');
  const boxes = page.getByRole('textbox');
  const isMatch = (await page.getByText(/Tap a term, then tap where it belongs/i).count()) > 0;
  if ((await radios.count()) === 0 && (await boxes.count()) === 0 && !isMatch) return 'none';
  if (isMatch) {
    // matchPairs: terms are radios, definition rows are buttons (not the footer's). A wrong set is a valid attempt.
    // Empty definition rows show a "?" badge; filled ones show the term's number.
    const n = await radios.count();
    for (let i = 0; i < n; i++) {
      await radios.nth(i).click();
      const free = page.getByRole('button').filter({ hasText: /^\?/ });
      if ((await free.count()) > 0) await free.first().click();
    }
    await page.getByRole('button', { name: /^check( again)?$/i }).first().click();
    await page.getByText(/Nice!|Close!|Not quite/).first().waitFor({ timeout: 20_000 });
    await shot(page, 'lesson-feedback-matchpairs');
    const skip = page.getByRole('button', { name: /^skip for now/i });
    if ((await skip.count()) > 0) await skip.first().click();
    else await page.getByRole('button', { name: /^continue$/i }).first().click();
    return 'answered';
  }
  if ((await radios.count()) === 0) {
    // fillBlank: the journey does not know the accepted answers; it attempts, reads the teaching
    // text, and moves on with "Skip for now" (a legitimate learner path; attempts count as answered).
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).fill('a guess');
    await page.getByRole('button', { name: /^check( again)?$/i }).first().click();
    await page.getByText(/Nice!|Close!|Not quite/).first().waitFor({ timeout: 20_000 });
    await shot(page, 'lesson-feedback-fillblank');
    const skip = page.getByRole('button', { name: /^skip for now/i });
    if ((await skip.count()) > 0) await skip.first().click();
    return 'answered';
  }
  const count = await radios.count();
  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    if (await radio.isDisabled().catch(() => false)) continue;
    await radio.click();
    const check = page.getByRole('button', { name: /^check( again)?$/i });
    if ((await check.count()) === 0) return 'answered';
    await check.first().click();
    // The explanation sheet: "Nice! That's it." when right, "Close! Here's the idea" when wrong.
    await page.getByText(/Nice!|Close!|Not quite/).first().waitFor({ timeout: 20_000 });
    await shot(page, `lesson-feedback-${i + 1}`);
    if ((await page.getByText(/Nice!/).count()) > 0) return 'answered';
    // Wrong: the sheet offers Try again, which clears the explanation so another option can be checked.
    const tryAgain = page.getByRole('button', { name: /^try again$/i });
    if ((await tryAgain.count()) > 0) await tryAgain.first().click();
  }
  return 'answered';
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));

  if (process.env.QA_TOKEN) {
    await page.goto(base);
    await page.evaluate((token) => window.localStorage.setItem('indy.learnerToken', token), process.env.QA_TOKEN);
  }

  if (process.env.QA_COURSE) {
    await page.goto(`${base}/course/${process.env.QA_COURSE}`);
  } else {
    await page.goto(base);
    await page.getByLabel('What do you want to learn?').first().waitFor({ timeout: 30_000 });
    await shot(page, 'home');
    await page.getByLabel('What do you want to learn?').fill(goal);
    await shot(page, 'home-filled');
    await page.getByRole('button', { name: /let.s go/i }).click();
    await page.waitForURL(/\/intake\//, { timeout: 60_000 });

    for (let turn = 1; turn <= 6; turn++) {
      const build = page.getByRole('button', { name: /build my course/i });
      const chip = page.getByTestId('intake-chip');
      await Promise.race([build.first().waitFor({ timeout: 60_000 }), chip.first().waitFor({ timeout: 60_000 })]);
      await shot(page, `intake-${turn}`);
      if ((await build.count()) > 0) {
        await build.first().click();
        break;
      }
      const label = await chip.first().innerText();
      log(`answering with chip "${label}"`);
      await chip.first().click();
      await page.getByText('…', { exact: true }).first().waitFor({ timeout: 10_000 }).catch(() => undefined);
      await page.getByText('…', { exact: true }).first().waitFor({ state: 'hidden', timeout: 90_000 });
    }
    await page.waitForTimeout(1500);
    await shot(page, 'intake-planning');
    await page.waitForURL(/\/course\//, { timeout: 180_000 });
  }

  await page.getByText(/Skill tree/).first().waitFor({ timeout: 30_000 });
  await shot(page, 'course');
  await page.getByText(/^Ready$/).first().waitFor({ timeout: 180_000 });
  await shot(page, 'course-ready');

  await page.getByRole('button', { name: /Up next\./ }).first().click();
  await page.waitForURL(/\/lesson\//, { timeout: 120_000 });
  await page.getByRole('progressbar').waitFor({ timeout: 60_000 });

  for (let slide = 1; slide <= 14; slide++) {
    await page.waitForTimeout(400);
    if ((await page.getByText(/Lesson complete/).count()) > 0) break;
    await shot(page, `lesson-slide-${slide}`);
    const before = await page.getByRole('progressbar').getAttribute('aria-valuenow');
    await answerSlide(page);
    if ((await page.getByRole('progressbar').getAttribute('aria-valuenow')) !== before) continue; // skip moved us on
    const finish = page.getByRole('button', { name: /^finish$/i });
    if ((await finish.count()) > 0) {
      const at = await page.getByRole('progressbar').getAttribute('aria-valuenow');
      await finish.first().click();
      const celebrated = await page
        .getByText(/Lesson complete|Skill tree finished/)
        .first()
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (celebrated) break;
      // Finish jumps back to an unanswered check; keep going from there.
      if ((await page.getByRole('progressbar').count()) > 0 && (await page.getByRole('progressbar').getAttribute('aria-valuenow')) !== at) {
        log('finish sent us back to an open check');
        continue;
      }
      log('no celebration screen seen');
      break;
    }
    await page.getByRole('button', { name: /^continue$/i }).first().click();
  }

  await shot(page, 'celebration');
  const cont = page.getByRole('button', { name: /^continue$/i });
  if ((await cont.count()) > 0) await cont.first().click();
  await page.waitForURL(/\/course\//, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await shot(page, 'course-after');

  await browser.close();
  log(`done: ${shotIndex} screenshots in ${outDir} (${viewportName} ${viewport.width}x${viewport.height})`);
  if (errors.length) {
    log(`${errors.length} console/page errors:`);
    for (const e of [...new Set(errors)].slice(0, 15)) console.log('  ' + e);
  } else {
    log('no console or page errors');
  }
}

main().catch((e) => {
  console.error('JOURNEY FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
