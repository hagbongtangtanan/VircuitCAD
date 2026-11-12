import { mkdirSync, readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

type AppWindow = Window & {
  __app?: { loadText(text: string): void; store: { addPart(id: string, options: unknown): void } };
  __editor?: {
    setViewport(viewport: { scale: number; x: number; y: number }): void;
    getToolController(): {
      setTool(tool: string): void;
      pointerDown(point: { x: number; y: number }): void;
      pointerMove(point: { x: number; y: number }): void;
    };
  };
};

const OUT = 'artifacts/screens';
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];
const STATES = ['empty', 'placed', 'selected', 'wire', 'light'] as const;

mkdirSync(OUT, { recursive: true });

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));
  await expect(page.getByTestId('canvas-host').locator('canvas')).toBeVisible();
  await page.evaluate(() => (window as AppWindow).__editor?.setViewport({ scale: 1, x: 0, y: 0 }));
}

async function applyState(page: Page, state: (typeof STATES)[number]): Promise<void> {
  if (state === 'light') {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
    return;
  }
  if (state === 'empty') return;

  const text = readFileSync('examples/led-resistor.vcad', 'utf8');
  await page.evaluate((value) => (window as AppWindow).__app?.loadText(value), text);

  if (state === 'selected') {
    await page.evaluate(() => {
      const app = window as AppWindow;
      app.__app?.store.addPart('resistor', { position: { x: 5, y: 5 } });
      const controller = app.__editor?.getToolController();
      controller?.setTool('select');
      controller?.pointerDown({ x: 5, y: 5 });
    });
  }
  if (state === 'wire') {
    await page.evaluate(() => {
      const controller = (window as AppWindow).__editor?.getToolController();
      controller?.setTool('wire');
      controller?.pointerDown({ x: 0, y: 3 });
      controller?.pointerMove({ x: 8, y: 3 });
    });
    const box = await page.getByTestId('canvas-host').locator('canvas').boundingBox();
    if (box) await page.mouse.move(box.x + 8 * 20, box.y + 3 * 20);
  }
}

test('captures the app states at three viewport sizes', async ({ page }) => {
  test.setTimeout(180_000);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    for (const state of STATES) {
      await ready(page);
      await applyState(page, state);
      await page.screenshot({ path: `${OUT}/${state}-${size.width}x${size.height}.png` });
    }
  }
});

test('captures the parts gallery', async ({ page }) => {
  test.setTimeout(180_000);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto('/gallery.html');
    await expect(page.getByTestId('gallery')).toBeVisible();
    await expect(page.getByTestId('gallery-part-resistor')).toBeVisible();
    await page.screenshot({ path: `${OUT}/gallery-${size.width}x${size.height}.png`, fullPage: true });
  }
});

test('flags clipped text, controls under 28 px and overlapping regions', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  const text = readFileSync('examples/led-resistor.vcad', 'utf8');
  await page.evaluate((value) => (window as AppWindow).__app?.loadText(value), text);

  const issues = await page.evaluate(() => {
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (element.tagName === 'CANVAS' || element.closest('svg')) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (element.childElementCount === 0 && style.overflowX !== 'auto' && style.overflowX !== 'scroll') {
        if (element.scrollWidth - element.clientWidth > 1) {
          found.push(`clipped text: <${element.tagName.toLowerCase()} class="${element.className}">`);
        }
      }
    }
    for (const control of document.querySelectorAll<HTMLElement>('button, input, select')) {
      const type = control.getAttribute('type');
      if (type === 'checkbox' || type === 'radio') continue;
      const rect = control.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.height < 27.5) {
        found.push(
          `control under 28px: ${control.getAttribute('aria-label') ?? control.tagName} (${Math.round(rect.height)}px)`,
        );
      }
    }
    const region = (id: string): DOMRect | undefined =>
      document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
    const left = region('left-panel');
    const canvas = region('canvas-host');
    const right = region('right-panel');
    const toolbar = region('app-toolbar');
    const status = region('app-status');
    if (left && canvas && right && left.right > canvas.left + 1) found.push('left panel overlaps canvas');
    if (canvas && right && canvas.right > right.left + 1) found.push('canvas overlaps right panel');
    if (toolbar && canvas && toolbar.bottom > canvas.top + 1) found.push('toolbar overlaps canvas');
    if (canvas && status && status.top < canvas.bottom - 1) found.push('status overlaps canvas');
    return found;
  });

  expect(issues, issues.join('\n')).toEqual([]);
});
