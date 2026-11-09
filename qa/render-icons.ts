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
 *
 * Native (#72), rendered at 1024:
 *   assets/icon.png                     full-bleed opaque square (iOS masks it; no transparency allowed)
 *   assets/android-icon-foreground.png  face on transparent, inside the adaptive-icon safe circle
 *   assets/android-icon-monochrome.png  the foreground's dark line art only (Android 13 themed icons)
 *   assets/splash-icon.png              face on transparent (expo-splash-screen paints the purple)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8796';
const outDir = path.resolve('public/icons');

type Shape = 'rounded' | 'square' | 'maskable' | 'foreground' | 'splash';

async function shoot(page: Page, shape: Shape, size = 512): Promise<Buffer> {
  await page.goto(`${base}/dev/icon?size=${size}&shape=${shape}`);
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

/** Keep only the dark ink (outline, eyes, mouth) as opaque white: Android tints it for themed icons. */
async function lineArt(page: Page, png: Buffer): Promise<Buffer> {
  const dataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const luminance = 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;
      const ink = px[i + 3]! > 128 && luminance < 90;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = ink ? 255 : 0;
    }
    ctx.putImageData(data, 0, 0);
    return c.toDataURL('image/png');
  }, png.toString('base64'));
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

  const big = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });
  const foreground = await shoot(big, 'foreground', 1024);
  const nativeFiles: Record<string, Buffer> = {
    'icon.png': await shoot(big, 'square', 1024),
    'android-icon-foreground.png': foreground,
    'android-icon-monochrome.png': await lineArt(big, foreground),
    'splash-icon.png': await shoot(big, 'splash', 1024),
  };
  for (const [name, buf] of Object.entries(nativeFiles)) {
    writeFileSync(path.resolve('assets', name), buf);
    console.log(`wrote assets/${name} (${buf.length} bytes)`);
  }

  await browser.close();
}

void main();
