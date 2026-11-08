/**
 * Accessibility audit: axe-core (WCAG 2.0/2.1 A+AA) plus keyboard passes, against a running web build.
 * Phone viewport. The intake step makes one real model call.
 *
 *   npx tsx qa/a11y/audit.ts                 # all pages
 *   QA_SKIP_INTAKE=1 npx tsx qa/a11y/audit.ts  # no model call
 *   QA_BASE_URL=http://127.0.0.1:8787 npx tsx qa/a11y/audit.ts
 *
 * Fixtures: qa/a11y/slide-visuals.json (text + ratioBar + diagram), qa/a11y/slide-interactive.json
 * (multipleChoice + checklist), qa/a11y/slide-match.json (companion callout + matchPairs) and
 * qa/a11y/slide-fill.json (text with a link + fillBlank), rendered through /dev/slide. The script
 * reports and never exits non-zero on a finding; the CHECKS section lists PASS/FAIL for the #20
 * behaviours (keyboard, live regions, focus on arrival, decorative avatars, link names).
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

const checks: { name: string; ok: boolean; detail: string }[] = [];
/** Records one PASS/FAIL line for the CHECKS summary and prints it where it happened. */
function check(name: string, ok: boolean, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/** The text in the app's live regions, by politeness. */
async function liveRegions(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-live]')).map((e) => ({ live: e.getAttribute('aria-live') ?? '', text: (e.textContent ?? '').trim() })),
  );
}

/** Live regions settle 60 ms after an announcement; poll until the polite one matches `pattern`. */
async function politeSays(page: Page, pattern: RegExp, timeout = 2000): Promise<string> {
  const end = Date.now() + timeout;
  let last = '';
  while (Date.now() < end) {
    last = (await liveRegions(page)).filter((r) => r.live === 'polite').map((r) => r.text).join(' | ');
    if (pattern.test(last)) return last;
    await page.waitForTimeout(100);
  }
  return last;
}

/** Page-level structure every screen should have after #20. */
async function structureChecks(page: Page, name: string, expectFocus: RegExp | null) {
  section(`STRUCTURE: ${name}`);
  const regions = await liveRegions(page);
  const polite = regions.filter((r) => r.live === 'polite').length;
  const assertive = regions.filter((r) => r.live === 'assertive').length;
  check(`${name}: one persistent polite and one assertive live region`, polite === 1 && assertive === 1, `polite=${polite} assertive=${assertive}`);
  const nested = await page.evaluate(() => document.querySelectorAll('h1 h1, h1 h2, h1 h3, [role=heading] [role=heading]').length);
  check(`${name}: no heading inside another heading`, nested === 0, `nested=${nested}`);
  const companions = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role=img][aria-label*="your companion"]'))
      .filter((e) => !e.closest('[aria-hidden=true]'))
      .map((e) => e.getAttribute('aria-label') ?? ''),
  );
  check(
    `${name}: at most one companion image exposed, in human words`,
    companions.length <= 1 && companions.every((l) => !/, (happy|curious|thinking|cheering)(,|$)/.test(l)),
    companions.join(' / ') || 'none',
  );
  if (expectFocus) {
    await page.waitForTimeout(150);
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return { tag: el?.tagName.toLowerCase() ?? 'none', text: (el?.textContent ?? '').trim().slice(0, 60) };
    });
    check(`${name}: focus starts at the heading`, /^h\d$/.test(f.tag) && expectFocus.test(f.text), `${f.tag} "${f.text}"`);
  }
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
  const radioStops = order.filter((f) => f.role === 'radio').length;
  check('radio group is one tab stop (roving tabindex)', radioStops === 1, `radios=${n}, in tab order=${radioStops}`);
  const checked = async () => Promise.all(Array.from({ length: n }, (_, i) => radios.nth(i).getAttribute('aria-checked')));
  const focusLabel = async () => (await focused(page)).label;

  await radios.nth(0).focus();
  await page.keyboard.press(' ');
  check('Space selects the focused radio', (await checked())[0] === 'true', JSON.stringify(await checked()));
  await page.keyboard.press('ArrowDown');
  check('ArrowDown moves focus to the next radio and selects it', (await focusLabel()).startsWith('B.') && (await checked())[1] === 'true' && (await checked())[0] === 'false', `${await focusLabel()} ${JSON.stringify(await checked())}`);
  await page.keyboard.press('ArrowRight');
  check('ArrowRight moves on too', (await focusLabel()).startsWith('C.') && (await checked())[2] === 'true', await focusLabel());
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  check('ArrowUp wraps from the first radio to the last', (await focusLabel()).startsWith('D.') && (await checked())[3] === 'true', await focusLabel());
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  check('ArrowLeft moves back', (await focusLabel()).startsWith('B.') && (await checked())[1] === 'true', await focusLabel());
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  check('Tab back into the group lands on the checked radio', (await focusLabel()).startsWith('B.'), await focusLabel());
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press(' ');
  check('Space on a radio does not scroll the page', (await page.evaluate(() => window.scrollY)) === scrollY);

  const checkButton = page.getByRole('button', { name: /^check$/i });
  let reached = false;
  for (let i = 0; i < 4 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = /^check$/i.test(await focusLabel());
  }
  check('Tab from the group reaches Check', reached, `aria-disabled=${await checkButton.getAttribute('aria-disabled')}`);
  await page.keyboard.press('Enter');
  const fb = page.getByText(/Nice!|Not quite/);
  await fb.first().waitFor({ timeout: 5000 }).catch(() => undefined);
  check('Enter on Check shows the feedback', (await fb.count()) > 0);
  const said = await politeSays(page, /Correct\./);
  check('feedback is announced through the persistent polite region', /Correct\. Yes\. Acid/.test(said), said.slice(0, 80));

  section('KEYBOARD ACTIVATION: checklist');
  // Use an item no earlier step could have touched, and compare with its starting state.
  const box = page.getByRole('checkbox').last();
  await box.focus();
  const start = await box.getAttribute('aria-checked');
  await page.keyboard.press(' ');
  const afterSpace = await box.getAttribute('aria-checked');
  check('Space toggles a checklist item', afterSpace !== start, `${start} → ${afterSpace}`);
  await page.keyboard.press(' ');
  check('Space again toggles it back', (await box.getAttribute('aria-checked')) === start);
  await page.keyboard.press('Enter');
  check('Enter still toggles it', (await box.getAttribute('aria-checked')) !== start);
  if ((await box.getAttribute('aria-checked')) !== 'true') await page.keyboard.press('Enter');
  const tick = await box.evaluate((el) => el.textContent ?? '');
  check('a ticked item has a drawn tick, not a font glyph read aloud', (await box.getAttribute('aria-checked')) === 'true' && !tick.includes('✓'), JSON.stringify(tick.slice(0, 40)));
}

async function matchKeyboard(page: Page) {
  const order = await tabOrder(page, 'Slide: matchPairs', 14);
  section('KEYBOARD ACTIVATION: matchPairs');
  const chipStops = order.filter((f) => f.role === 'radio').length;
  check('terms are one tab stop (roving tabindex)', chipStops === 1, `in tab order=${chipStops}`);
  const chip = (name: string) => page.getByRole('radio', { name: new RegExp(`^${name}`) });
  const row = (name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) });
  const focusLabel = async () => (await focused(page)).label;

  await chip('Acid').focus();
  await page.keyboard.press(' ');
  check('Space picks a term', (await chip('Acid').getAttribute('aria-checked')) === 'true');
  const hint = await politeSays(page, /Now choose where Acid belongs/);
  check('picking is announced with what to do next', /Now choose where Acid belongs/.test(hint), hint.slice(0, 60));
  await page.keyboard.press('Tab');
  const tabbed = await focused(page);
  check('Tab from the picked term goes to the rows', tabbed.role === 'button' && tabbed.label !== '', tabbed.label);
  await row('Brightens and cuts sweetness').focus();
  await page.keyboard.press(' ');
  check('Space on a row places the picked term', /matched with Brightens/.test((await chip('Acid').getAttribute('aria-label')) ?? ''));
  check('focus returns to the next term without a row', (await focusLabel()).startsWith('Sugar'), await focusLabel());
  await page.keyboard.press('Enter');
  check('Enter picks a term too', (await chip('Sugar').getAttribute('aria-checked')) === 'true');
  await row('Rounds off sharp edges').focus();
  await page.keyboard.press('Enter');
  check('Enter on a row places it', /matched with Rounds/.test((await chip('Sugar').getAttribute('aria-label')) ?? ''));
  check('focus moves to the last unmatched term', (await focusLabel()).startsWith('Dilution'), await focusLabel());
  await page.keyboard.press('ArrowUp');
  check('ArrowUp moves to and picks the previous term', (await focusLabel()).startsWith('Sugar') && (await chip('Sugar').getAttribute('aria-checked')) === 'true', await focusLabel());
  await page.keyboard.press('ArrowDown');
  check('ArrowDown moves back and picks', (await focusLabel()).startsWith('Dilution') && (await chip('Dilution').getAttribute('aria-checked')) === 'true', await focusLabel());
  await row('Opens up the flavors').focus();
  await page.keyboard.press(' ');
  const checkButton = page.getByRole('button', { name: /^check$/i });
  check('all placed: Check is enabled', (await checkButton.getAttribute('aria-disabled')) !== 'true');
  await checkButton.focus();
  await page.keyboard.press('Enter');
  const said = await politeSays(page, /All matched/);
  check('the result is announced', /All matched/.test(said), said.slice(0, 60));
}

async function fillKeyboard(page: Page) {
  await tabOrder(page, 'Slide: fillBlank', 10);
  section('KEYBOARD ACTIVATION: fillBlank + link');
  const link = page.getByRole('link');
  const name = (await link.getAttribute('aria-label')) ?? '';
  check('link says it opens in the browser in its name', /\(opens in browser\)$/.test(name), name);
  const arrowHidden = await link.evaluate((el) => Array.from(el.querySelectorAll('[aria-hidden=true]')).some((e) => e.textContent?.includes('↗')));
  check('the ↗ is hidden from screen readers', arrowHidden);

  const gap1 = page.getByLabel('Gap 1 of 2');
  const gap2 = page.getByLabel('Gap 2 of 2');
  await gap1.focus();
  await page.keyboard.type('2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  check('Enter in gap 1 moves to gap 2', (await focused(page)).label === 'Gap 2 of 2', (await focused(page)).label);
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  const fb = page.getByText(/Not quite|Nice!/);
  await fb.first().waitFor({ timeout: 5000 }).catch(() => undefined);
  check('Enter in the last gap checks the answer', (await fb.count()) > 0);
  const said = await politeSays(page, /Not quite/);
  check('the wrong gap is announced with its explanation', /Not quite\. One part sour/.test(said), said.slice(0, 80));
  await gap2.fill('1');
  await gap2.focus();
  await page.keyboard.press('Enter');
  const right = await politeSays(page, /Correct\./);
  check('a corrected answer can be rechecked from the keyboard', /Correct\./.test(right), right.slice(0, 40));
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
    ['control #8F82C4 edge (non-text)', '#8F82C4', 'bg #FFFFFF', '#FFFFFF'],
    ['control #8F82C4 edge (non-text)', '#8F82C4', 'soft #F3F0FA', '#F3F0FA'],
    ['purple #6D28D9 picked/target edge', '#6D28D9', 'bg #FFFFFF', '#FFFFFF'],
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
  await structureChecks(page, 'Home', /^Poko$/);
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
    ['slide-match.json', 'Slide: matchPairs'],
    ['slide-fill.json', 'Slide: fillBlank'],
  ] as const) {
    const json = fs.readFileSync(path.join(here, file), 'utf8');
    await page.goto(`${base}/dev/slide?doc=${encodeURIComponent(JSON.stringify(JSON.parse(json)))}`);
    await page.getByText('QA HARNESS').waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const invalid = (await page.getByText('Slide did not validate').count()) > 0;
    log(`${file} ${invalid ? 'DID NOT VALIDATE' : 'rendered'}`);
    await structureChecks(page, label, new RegExp(`^${(JSON.parse(json) as { title: string }).title}$`));
    summary[file] = await axe(page, label);
    await hitTargets(page, label);
    await ariaDump(page, label);
    if (file === 'slide-interactive.json') await slideKeyboard(page);
    if (file === 'slide-match.json') await matchKeyboard(page);
    if (file === 'slide-fill.json') await fillKeyboard(page);
  }

  contrastTable();

  section('SUMMARY: axe violations per page');
  for (const [name, vs] of Object.entries(summary)) {
    const total = vs.reduce((n, v) => n + v.nodes.length, 0);
    console.log(`- ${name}: ${vs.length} rule(s), ${total} node(s)${vs.length ? ' → ' + vs.map((v) => `${v.id}[${v.impact}]x${v.nodes.length}`).join(', ') : ''}`);
  }
  section(`CHECKS (#20): ${checks.filter((c) => c.ok).length}/${checks.length} pass`);
  for (const c of checks) console.log(`- ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : `  (${c.detail})`}`);
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
