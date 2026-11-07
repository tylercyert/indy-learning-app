/**
 * Render the PWA icons from the live Poko companion (route /dev/icon) into public/icons/.
 *   [QA_BASE_URL=http://127.0.0.1:8796] npx tsx qa/render-icons.ts
 * Needs a server serving a web export that contains app/dev/icon.tsx. No model calls.
 *
 * Output (all real PNGs, screenshotted at 512 then downscaled in-browser with stepwise halving):
 *   icon-512.png            rounded purple square, transparent corners   (manifest, purpose any)
 *   icon-192.png            same, 192                                     (manifest, purpose any)
 *   icon-32.png             same, 32                                      (favicon)
 *   apple-touch-icon.png    full-bleed square, 180 (iOS applies its own corner mask)
 *   icon-maskable-512.png   full-bleed square, Poko inside the central safe zone (purpose maskable)
 *   ../../assets/favicon.png rounded, 48 (Expo copies it to dist/favicon.ico)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8796';
const outDir = path.resolve('public/icons');

async function shoot(page: Page, shape: 'rounded' | 'square' | 'maskable'): Promise<Buffer> {
  await page.goto(`${base}/dev/icon?size=512&shape=${shape}`);
  const icon = page.getByTestId('icon');
  await icon.waitFor({ timeout: 30_000 });
  // Fonts and layout settle; the companion is pure Views, so this is generous.
  await page.waitForTimeout(600);
  // The shell paints html/body purple and the navigator paints its card white; the rounded corners
  // must come out transparent, so every ancestor of the icon loses its background first.
  await icon.evaluate((node) => {
    let el: HTMLElement | null = node.parentElement;
    while (el) {
      el.style.setProperty('background', 'transparent', 'important');
      el = el.parentElement;
    }
  });
  return icon.screenshot({ omitBackground: true, type: 'png' });
}

/** Downscale a PNG in the browser, halving until within 2x of the target, then one final resample. */
async function downscale(page: Page, png: Buffer, target: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async ({ b64, target }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      // No named inner functions here: tsx/esbuild would inject a `__name` helper that does not
      // exist inside the page.
      let source: CanvasImageSource = img;
      let size = img.width;
      let canvas: HTMLCanvasElement | null = null;
      const sizes: number[] = [];
      while (size / 2 >= target * 2) {
        size = size / 2;
        sizes.push(size);
      }
      sizes.push(target);
      for (const next of sizes) {
        const c = document.createElement('canvas');
        c.width = next;
        c.height = next;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, next, next);
        source = c;
        canvas = c;
      }
      return canvas!.toDataURL('image/png');
    },
    { b64: png.toString('base64'), target },
  );
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });

  const rounded = await shoot(page, 'rounded');
  const square = await shoot(page, 'square');
  const maskable = await shoot(page, 'maskable');

  const files: Record<string, Buffer> = {
    'icon-512.png': rounded,
    'icon-192.png': await downscale(page, rounded, 192),
    'icon-32.png': await downscale(page, rounded, 32),
    'apple-touch-icon.png': await downscale(page, square, 180),
    'icon-maskable-512.png': maskable,
  };
  for (const [name, buf] of Object.entries(files)) {
    writeFileSync(path.join(outDir, name), buf);
    console.log(`wrote public/icons/${name} (${buf.length} bytes)`);
  }
  const favicon = await downscale(page, rounded, 48);
  writeFileSync(path.resolve('assets/favicon.png'), favicon);
  console.log(`wrote assets/favicon.png (${favicon.length} bytes)`);

  await browser.close();
}

void main();
