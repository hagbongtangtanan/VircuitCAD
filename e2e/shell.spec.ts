import { expect, test, type Page } from '@playwright/test';

type AppWindow = Window & { __app?: unknown };

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

type Box = { x: number; y: number; width: number; height: number; right: number; bottom: number };

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));
  await expect(page.getByTestId('canvas-host').locator('canvas')).toBeVisible();
}

test('shell has no overflow or overlap at common viewport sizes and DPRs', async ({ browser }) => {
  test.setTimeout(120_000);
  for (const deviceScaleFactor of [1, 1.25]) {
    const context = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as AppWindow).__app));
    await expect(page.getByTestId('canvas-host').locator('canvas')).toBeVisible();

    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));

      const metrics = await page.evaluate(() => {
        const element = (id: string): HTMLElement => {
          const node = document.querySelector(`[data-testid="${id}"]`);
          if (!node) throw new Error(`missing ${id}`);
          return node as HTMLElement;
        };
        const box = (node: HTMLElement): Box => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom,
          };
        };
        return {
          scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          left: box(element('left-panel')),
          right: box(element('right-panel')),
          canvas: box(element('canvas-host')),
          status: box(element('app-status')),
          toolbar: box(element('app-toolbar')),
        };
      });

      const label = `${size.width}x${size.height}@${deviceScaleFactor}`;
      expect(metrics.scrollWidth, `overflow ${label}`).toBeLessThanOrEqual(metrics.innerWidth);
      expect(metrics.left.right, `left/canvas ${label}`).toBeLessThanOrEqual(metrics.canvas.x + 1);
      expect(metrics.canvas.right, `canvas/right ${label}`).toBeLessThanOrEqual(metrics.right.x + 1);
      expect(metrics.canvas.width, `canvas grows ${label}`).toBeGreaterThan(200);
      expect(metrics.canvas.height, `canvas height ${label}`).toBeGreaterThan(200);
      expect(metrics.status.bottom, `status fits ${label}`).toBeLessThanOrEqual(
        metrics.innerHeight + 1,
      );
      expect(metrics.toolbar.height, `toolbar height ${label}`).toBeLessThanOrEqual(44);
      expect(
        metrics.innerWidth - metrics.left.width - metrics.right.width - 12,
        `canvas fills ${label}`,
      ).toBeLessThanOrEqual(metrics.canvas.width);
    }

    await context.close();
  }
});

test('collapsing a side panel grows the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);

  const before = await page.getByTestId('canvas-host').boundingBox();
  await page.getByRole('button', { name: 'Hide parts panel' }).click();
  await expect(page.getByTestId('left-panel')).toHaveCount(0);
  const after = await page.getByTestId('canvas-host').boundingBox();
  expect(after?.width ?? 0).toBeGreaterThan((before?.width ?? 0) + 40);

  await page.getByRole('button', { name: 'Show parts panel' }).click();
  await expect(page.getByTestId('left-panel')).toHaveCount(1);
});

test('dragging the separator resizes the panel within bounds', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);

  const separator = page.getByTestId('separator-left');
  const box = await separator.boundingBox();
  if (!box) throw new Error('no separator');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  const grown = await page.getByTestId('left-panel').boundingBox();
  expect(grown?.width ?? 0).toBeGreaterThan(300);

  await page.mouse.move((await separator.boundingBox())!.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 400, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  const clamped = await page.getByTestId('left-panel').boundingBox();
  expect(clamped?.width ?? 0).toBeGreaterThanOrEqual(200);
  expect(clamped?.width ?? 0).toBeLessThanOrEqual(420);
});
