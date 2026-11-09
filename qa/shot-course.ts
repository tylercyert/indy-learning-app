/**
 * Tall screenshot of one course screen, so the whole skill path is visible in one image.
 *   QA_TOKEN=<learner token> QA_COURSE=<course id> [QA_BASE_URL=http://127.0.0.1:8787] [QA_WIDTH=390] [QA_HEIGHT=2200] [QA_OUT=qa/out/course.png] npx tsx qa/shot-course.ts
 * No model calls: it only opens an existing course.
 */
import { chromium } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const token = process.env.QA_TOKEN;
const course = process.env.QA_COURSE;
const width = Number(process.env.QA_WIDTH ?? 390);
const height = Number(process.env.QA_HEIGHT ?? 2200);
const out = process.env.QA_OUT ?? 'qa/out/course.png';

async function main(): Promise<void> {
  if (!token || !course) throw new Error('QA_TOKEN and QA_COURSE are required');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(base);
  await page.evaluate((t) => window.localStorage.setItem('poko.learnerToken', t), token);
  await page.goto(`${base}/course/${course}`);
  await page.getByText(/Skill tree/).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out });
  console.log(`wrote ${out} (${width}x${height})`);
  await browser.close();
}

void main();
