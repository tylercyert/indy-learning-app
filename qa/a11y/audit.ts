/**
 * Accessibility audit: axe-core (WCAG 2.0/2.1 A+AA) plus keyboard passes, against a running web build.
 * Phone viewport. The intake step makes one real model call.
 *
 *   npx tsx qa/a11y/audit.ts                 # all pages
 *   QA_SKIP_INTAKE=1 npx tsx qa/a11y/audit.ts  # no model call
 *   QA_BASE_URL=http://127.0.0.1:8787 npx tsx qa/a11y/audit.ts
 *
 * Fixtures: qa/a11y/slide-visuals.json (text + ratioBar + diagram), qa/a11y/slide-interactive.json
 * (multipleChoice + checklist), rendered through /dev/slide. The script reports; it never asserts.
 */
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8787';
const viewport = { width: 390, height: 844 };
const here = path.dirname(new URL(import.meta.url).pathname);
const goal = 'Make great cocktails for a party on Saturday, including a non-alcoholic option';

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
const section = (title: string) => console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);

async function axe(page: Page, name: string): Promise<Violation[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  section(`AXE: ${name}  (${results.violations.length} rule(s) violated, ${results.passes.length} passed, ${results.incomplete.length} needs review)`);
  for (const v of results.violations) {
    console.log(`\n- ${v.id}  [${v.impact ?? 'n/a'}]  x${v.nodes.length}`);
    console.log(`  ${v.help}  (${v.helpUrl})`);
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`  selector: ${n.target.join(' ')}`);
      console.log(`  summary:  ${n.failureSummary?.split('\n').filter(Boolean).slice(0, 3).join(' | ')}`);
    }
    if (v.nodes.length > 3) console.log(`  ... ${v.nodes.length - 3} more node(s)`);
  }
  const review = results.incomplete.filter((i) => ['color-contrast', 'aria-required-children', 'aria-required-parent'].includes(i.id));
  if (review.length) {
    console.log(`\n  needs-review (axe could not decide): ${review.map((r) => `${r.id} x${r.nodes.length}`).join(', ')}`);
  }
  return results.violations;
}

/** Interactive elements whose rendered box is under 44x44 CSS px (WCAG 2.5.8 / Apple HIG). */
async function hitTargets(page: Page, name: string) {
  const small = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[role="button"],[role="radio"],[role="checkbox"],[role="link"],button,a,input,textarea'));
    return els
      .map((el) => {
        const r = el.getBoundingClientRect();
        const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '';
        return { role: el.getAttribute('role') ?? el.tagName.toLowerCase(), label, w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((e) => e.w > 0 && e.h > 0 && (e.w < 44 || e.h < 44));
  });
  section(`HIT TARGETS < 44px: ${name}  (${small.length})`);
  for (const s of small) console.log(`- ${s.role} "${s.label}"  ${s.w}x${s.h}`);
}

interface FocusInfo {
  tag: string;
  role: string | null;
  label: string;
  focusVisible: boolean;
  outline: string;
  boxShadow: string;
}

async function focused(page: Page): Promise<FocusInfo> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { tag: 'body', role: null, label: '', focusVisible: false, outline: '', boxShadow: '' };
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label') ?? (el as HTMLInputElement).placeholder ?? el.textContent?.trim().slice(0, 50) ?? '',
      focusVisible: el.matches(':focus-visible'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      boxShadow: cs.boxShadow,
    };
  });
}

const fmt = (f: FocusInfo) =>
  `${f.tag}${f.role ? `[role=${f.role}]` : ''} "${f.label}"  focus-visible=${f.focusVisible}  outline=${f.outline}${f.boxShadow !== 'none' ? `  shadow=${f.boxShadow}` : ''}`;

async function tabOrder(page: Page, name: string, max = 20): Promise<FocusInfo[]> {
  section(`KEYBOARD TAB ORDER: ${name}`);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: FocusInfo[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const f = await focused(page);
    if (f.tag === 'body') {
      console.log(`${String(i + 1).padStart(2)}. (focus left the document / wrapped)`);
      break;
    }
    seen.push(f);
    console.log(`${String(i + 1).padStart(2)}. ${fmt(f)}`);
  }
  const noRing = seen.filter((f) => f.focusVisible && f.outline.startsWith('none') && f.boxShadow === 'none');
  console.log(`\n  focused elements with NO visible ring (outline none, no box-shadow): ${noRing.length}/${seen.length}`);
  return seen;
}

async function homeKeyboard(page: Page) {
  await tabOrder(page, 'Home');
  section('KEYBOARD ACTIVATION: Home');
  const input = page.getByLabel('What do you want to learn?');
  const chip = page.getByRole('button', { name: 'Learn Indonesian basics' });
  await chip.focus();
  await page.keyboard.press('Enter');
  const afterEnter = await input.inputValue();
  console.log(`- chip + Enter → input value: "${afterEnter}"  (${afterEnter === 'Learn Indonesian basics' ? 'activated' : 'NOT activated'})`);
  await input.fill('');
  await chip.focus();
  await page.keyboard.press(' ');
  const afterSpace = await input.inputValue();
  console.log(`- chip + Space → input value: "${afterSpace}"  (${afterSpace === 'Learn Indonesian basics' ? 'activated' : 'NOT activated'})`);

  const go = page.getByRole('button', { name: /let.s go/i });
  console.log(`- "Let's go" with empty input: aria-disabled=${await go.getAttribute('aria-disabled')} tabindex=${await go.getAttribute('tabindex')}`);
  await input.fill('x');
  console.log(`- "Let's go" with 1 char: aria-disabled=${await go.getAttribute('aria-disabled')}`);
  await input.fill('Learn Indonesian basics');
  console.log(`- "Let's go" with a goal: aria-disabled=${await go.getAttribute('aria-disabled')} tabindex=${await go.getAttribute('tabindex')}`);
  await go.focus();
  console.log(`- "Let's go" focusable: ${(await focused(page)).label}`);
  await input.fill('');
  // Disabled-but-focusable check: RNW keeps disabled pressables in the tab order?
  await go.focus();
  const f = await focused(page);
  console.log(`- disabled "Let's go" receives focus: ${f.label.includes('go') ? 'yes (focusable while aria-disabled)' : 'no'}`);
}

async function slideKeyboard(page: Page) {
  const order = await tabOrder(page, 'Slide: multipleChoice + checklist', 16);
  section('KEYBOARD ACTIVATION: multipleChoice');
  const radios = page.getByRole('radio');
  const n = await radios.count();
  console.log(`- radios in DOM: ${n}; focusable radios in tab order: ${order.filter((f) => f.role === 'radio').length}`);
  const first = radios.nth(0);
  const stateOf = async () => ({
    checked: await first.getAttribute('aria-checked'),
    selected: await first.getAttribute('aria-selected'),
    disabled: await first.getAttribute('aria-disabled'),
  });
  await first.focus();
  console.log(`- radio A focused: ${fmt(await focused(page))}`);
  console.log(`- before: ${JSON.stringify(await stateOf())}`);
  await page.keyboard.press(' ');
  console.log(`- after Space: ${JSON.stringify(await stateOf())}`);
  await page.keyboard.press('Enter');
  console.log(`- after Enter: ${JSON.stringify(await stateOf())}`);
  await page.keyboard.press('ArrowDown');
  console.log(`- after ArrowDown, focus on: ${fmt(await focused(page))}`);
  const second = radios.nth(1);
  await second.focus();
  await page.keyboard.press('Enter');
  console.log(`- radio B + Enter: aria-selected=${await second.getAttribute('aria-selected')} aria-checked=${await second.getAttribute('aria-checked')}; radio A aria-selected=${await first.getAttribute('aria-selected')}`);

  const check = page.getByRole('button', { name: /^check$/i });
  console.log(`- "Check" button present: ${await check.count()}; aria-disabled=${await check.getAttribute('aria-disabled')}`);
  // Tab from radio B forward until we land on Check.
  let reached = false;
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const f = await focused(page);
    if (/^check$/i.test(f.label)) {
      reached = true;
      console.log(`- reached "Check" after ${i + 1} Tab(s): ${fmt(f)}`);
      break;
    }
  }
  if (!reached) console.log('- "Check" NOT reached by Tab within 8 presses');
  await page.keyboard.press('Enter');
  const fb = page.getByText(/Nice!|Close!/);
  await fb.first().waitFor({ timeout: 5000 }).catch(() => undefined);
  const fbCount = await fb.count();
  console.log(`- Enter on "Check" → feedback shown: ${fbCount > 0 ? await fb.first().textContent() : 'NO'}`);
  const live = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-live]')).map((e) => `${e.getAttribute('aria-live')}:${(e.textContent ?? '').trim().slice(0, 40)}`));
  console.log(`- aria-live regions now in DOM: ${JSON.stringify(live)}`);
  const radioAfter = await page.evaluate(() => Array.from(document.querySelectorAll('[role="radio"]')).map((e) => `${e.getAttribute('aria-label')?.slice(0, 2)} sel=${e.getAttribute('aria-selected')} chk=${e.getAttribute('aria-checked')} dis=${e.getAttribute('aria-disabled')}`));
  console.log(`- radio states after feedback: ${JSON.stringify(radioAfter)}`);

  section('KEYBOARD ACTIVATION: checklist');
  const boxes = page.getByRole('checkbox');
  const box = boxes.nth(0);
  await box.focus();
  console.log(`- checkbox focused: ${fmt(await focused(page))}  aria-checked=${await box.getAttribute('aria-checked')}`);
  await page.keyboard.press(' ');
  console.log(`- after Space: aria-checked=${await box.getAttribute('aria-checked')}`);
  await page.keyboard.press('Enter');
  console.log(`- after Enter: aria-checked=${await box.getAttribute('aria-checked')}`);
}

async function ariaDump(page: Page, name: string) {
  section(`ARIA SNAPSHOT: ${name}`);
  const snap = await page.locator('body').ariaSnapshot();
  console.log(snap.split('\n').slice(0, 60).join('\n'));
  if (snap.split('\n').length > 60) console.log(`... (${snap.split('\n').length - 60} more lines)`);
}

// ---------- contrast (WCAG 2.x relative luminance) ----------
function lum(hex: string) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg: string, bg: string) {
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function contrastTable() {
  section('CONTRAST (computed from theme tokens)');
  const pairs: [string, string, string, string][] = [
    ['muted #6B6480', '#6B6480', 'bg #FFFFFF', '#FFFFFF'],
    ['muted #6B6480', '#6B6480', 'soft #F3F0FA', '#F3F0FA'],
    ['muted #6B6480', '#6B6480', 'coralTint #FFF4E5', '#FFF4E5'],
    ['muted #6B6480', '#6B6480', 'mintTint #CCFBF1', '#CCFBF1'],
    ['muted #6B6480', '#6B6480', 'yellowTint #FDE68A', '#FDE68A'],
    ['muted #6B6480', '#6B6480', 'greenTint #ECFDF5', '#ECFDF5'],
    ['foot/edge #B8AED6', '#B8AED6', 'bg #FFFFFF', '#FFFFFF'],
    ['placeholder #9B94B3', '#9B94B3', 'bg #FFFFFF', '#FFFFFF'],
    ['badge #92400E', '#92400E', 'yellowTint #FDE68A', '#FDE68A'],
    ['coralDeep #C2410C', '#C2410C', 'coralTint #FFF4E5', '#FFF4E5'],
    ['mintDeep #0F766E', '#0F766E', 'mintTint #CCFBF1', '#CCFBF1'],
    ['purple #6D28D9', '#6D28D9', 'bg #FFFFFF', '#FFFFFF'],
    ['purpleTint #DDD6FE', '#DDD6FE', 'purple #6D28D9', '#6D28D9'],
    ['yellow #FFC53D (unitProgress)', '#FFC53D', 'purple #6D28D9', '#6D28D9'],
    ['white (letterCorrect)', '#FFFFFF', 'green #34D399', '#34D399'],
    ['white (letterSelected)', '#FFFFFF', 'purple #6D28D9', '#6D28D9'],
    ['ink #1F1535', '#1F1535', 'coral #FF7A59', '#FF7A59'],
    ['ink #1F1535', '#1F1535', 'yellow #FFC53D', '#FFC53D'],
    ['ink #1F1535', '#1F1535', 'mint #14B8A6', '#14B8A6'],
    ['white (palette primary text)', '#FFFFFF', 'purple #6D28D9', '#6D28D9'],
    ['celebrateText #EDE9FE', '#EDE9FE', 'purple #6D28D9', '#6D28D9'],
    ['ring/dots #C4B5FD (non-text)', '#C4B5FD', 'bg #FFFFFF', '#FFFFFF'],
    ['line #E9E5F5 border (non-text)', '#E9E5F5', 'bg #FFFFFF', '#FFFFFF'],
  ];
  for (const [fgName, fg, bgName, bg] of pairs) {
    const r = contrast(fg, bg);
    const grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large/UI only' : 'FAIL';
    console.log(`- ${fgName.padEnd(32)} on ${bgName.padEnd(20)} ${r.toFixed(2)}:1  ${grade}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  const summary: Record<string, Violation[]> = {};

  // 1. Home
  await page.goto(base);
  await page.getByText('What do you want to learn?').first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  log('home loaded');
  summary.home = await axe(page, 'Home /');
  await hitTargets(page, 'Home');
  await ariaDump(page, 'Home');
  await homeKeyboard(page);

  // 2. Intake (one model call)
  if (!process.env.QA_SKIP_INTAKE) {
    await page.getByLabel('What do you want to learn?').fill(goal);
    await page.getByRole('button', { name: /let.s go/i }).click();
    await page.waitForURL(/\/intake\//, { timeout: 60_000 });
    log(`intake url: ${page.url()}`);
    await Promise.race([
      page.locator('[data-testid="intake-chip"]').first().waitFor({ timeout: 90_000 }),
      page.getByRole('button', { name: /build my course/i }).waitFor({ timeout: 90_000 }),
    ]);
    await page.waitForTimeout(500);
    log('intake turn ready');
    summary.intake = await axe(page, 'Intake /intake/:id');
    await hitTargets(page, 'Intake');
    await ariaDump(page, 'Intake');
    await tabOrder(page, 'Intake', 14);
  } else {
    log('intake skipped (QA_SKIP_INTAKE)');
  }

  // 3. Slide harness fixtures
  for (const [file, label] of [
    ['slide-visuals.json', 'Slide: text + ratioBar + diagram'],
    ['slide-interactive.json', 'Slide: multipleChoice + checklist'],
  ] as const) {
    const json = fs.readFileSync(path.join(here, file), 'utf8');
    await page.goto(`${base}/dev/slide?doc=${encodeURIComponent(JSON.stringify(JSON.parse(json)))}`);
    await page.getByText('QA HARNESS').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const invalid = (await page.getByText('Slide did not validate').count()) > 0;
    log(`${file} ${invalid ? 'DID NOT VALIDATE' : 'rendered'}`);
    summary[file] = await axe(page, label);
    await hitTargets(page, label);
    await ariaDump(page, label);
    if (file === 'slide-interactive.json') await slideKeyboard(page);
  }

  contrastTable();

  section('SUMMARY: axe violations per page');
  for (const [name, vs] of Object.entries(summary)) {
    const total = vs.reduce((n, v) => n + v.nodes.length, 0);
    console.log(`- ${name}: ${vs.length} rule(s), ${total} node(s)${vs.length ? ' → ' + vs.map((v) => `${v.id}[${v.impact}]x${v.nodes.length}`).join(', ') : ''}`);
  }
  if (errors.length) {
    console.log(`\n${errors.length} console/page errors:`);
    for (const e of [...new Set(errors)].slice(0, 8)) console.log('  ' + e);
  }
  await browser.close();
}

main().catch((e) => {
  console.error('AUDIT FAILED:', e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
