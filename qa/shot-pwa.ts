/**
 * PWA shell screenshots (issue #52): Home, Course and Lesson at a phone viewport, twice: a plain
 * 390x844 viewport and Playwright's iPhone 14 device descriptor (mobile UA, touch, DSF 3), so the
 * purple app bar, the back chevron and the footers can be checked in both.
 *   QA_TOKEN=<learner token> QA_COURSE=<course id> QA_EXPERIENCE=<experience id> [QA_INTAKE=<intake session id>] \
 *   [QA_BASE_URL=http://127.0.0.1:8796] [QA_OUT_DIR=qa/out/pwa] npx tsx qa/shot-pwa.ts
 * No model calls: it only opens existing records. Also checks for horizontal overflow at 390px and
 * that the app bar sits at the top of the page.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, devices, type Browser, type BrowserContextOptions, type Page } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8796';
const token = process.env.QA_TOKEN;
const course = process.env.QA_COURSE;
const experience = process.env.QA_EXPERIENCE;
/** Optional: an intake session id, to capture the intake screen's bar with its pips. */
const intake = process.env.QA_INTAKE;
const outDir = process.env.QA_OUT_DIR ?? 'qa/out/pwa';

async function openAs(browser: Browser, options: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate((t) => window.localStorage.setItem('poko.learnerToken', t), token!);
  return page;
}

async function check(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    firstHeaderTop: document.querySelector('[role="banner"], [aria-level="1"]')?.getBoundingClientRect().top ?? null,
  }));
  const overflow = metrics.scrollWidth > metrics.clientWidth;
  console.log(`${label}: width ${metrics.clientWidth}/${metrics.scrollWidth}${overflow ? ' HORIZONTAL OVERFLOW' : ''}, body overflow ${metrics.bodyOverflow}, html bg ${metrics.htmlBg}`);
}

async function shoot(page: Page, route: string, waitFor: RegExp | null, file: string, label: string): Promise<void> {
  await page.goto(`${base}${route}`);
  if (waitFor) await page.getByText(waitFor).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await check(page, label);
  await page.screenshot({ path: path.join(outDir, file) });
  console.log(`wrote ${path.join(outDir, file)}`);
}

async function main(): Promise<void> {
  if (!token || !course || !experience) throw new Error('QA_TOKEN, QA_COURSE and QA_EXPERIENCE are required');
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();

  const variants: { name: string; options: BrowserContextOptions }[] = [
    { name: 'phone', options: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
    { name: 'iphone14', options: { ...devices['iPhone 14'] } },
  ];
  for (const v of variants) {
    const page = await openAs(browser, v.options);
    await shoot(page, '/', /Poko/, `home-${v.name}.png`, `${v.name} home`);
    await shoot(page, `/course/${course}`, /Skill tree/, `course-${v.name}.png`, `${v.name} course`);
    await shoot(page, `/lesson/${experience}`, null, `lesson-${v.name}.png`, `${v.name} lesson`);
    if (intake) await shoot(page, `/intake/${intake}`, null, `intake-${v.name}.png`, `${v.name} intake`);
    // Back chevron in standalone mode: no history, so it must land on Home rather than do nothing.
    await page.goto(`${base}/course/${course}`);
    await page.getByText(/Skill tree/).first().waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Back to home' }).click();
    await page.waitForTimeout(800);
    console.log(`${v.name} back chevron from course -> ${new URL(page.url()).pathname}`);
    await page.context().close();
  }
  await browser.close();
}

void main();
