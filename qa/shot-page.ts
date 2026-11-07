/**
 * Tall screenshot of any route for an existing learner, so a whole screen is visible in one image.
 *   QA_TOKEN=<learner token> [QA_PATH=/] [QA_BASE_URL=http://127.0.0.1:8787] [QA_WIDTH=390] [QA_HEIGHT=1400] [QA_OUT=qa/out/page.png] npx tsx qa/shot-page.ts
 * No model calls.
 */
import { chromium } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const token = process.env.QA_TOKEN;
const route = process.env.QA_PATH ?? '/';
const width = Number(process.env.QA_WIDTH ?? 390);
const height = Number(process.env.QA_HEIGHT ?? 1400);
const out = process.env.QA_OUT ?? 'qa/out/page.png';

async function main(): Promise<void> {
  if (!token) throw new Error('QA_TOKEN is required');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(base);
  await page.evaluate((t) => window.localStorage.setItem('indy.learnerToken', t), token);
  await page.goto(`${base}${route}`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out });
  console.log(`wrote ${out} (${width}x${height}) for ${route}`);
  await browser.close();
}

void main();
