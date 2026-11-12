import { expect, test, type Page } from '@playwright/test';

type AppWindow = Window & {
  __app?: unknown;
  __editor?: { getViewport(): { scale: number } };
  __renderCount: number;
};

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));
  await expect(page.getByTestId('canvas-host').locator('canvas')).toBeVisible();
}

const scaleOf = (page: Page): Promise<number> =>
  page.evaluate(() => (window as AppWindow).__editor?.getViewport().scale ?? 0);

test('on-canvas zoom controls change the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);

  const before = await scaleOf(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect(await scaleOf(page)).toBeGreaterThan(before);

  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Fit to content' }).click();
  expect(await scaleOf(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await expect(page.getByTestId('canvas-zoom')).toHaveText('100%');

  const grid = page.getByRole('button', { name: 'Toggle grid' });
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  await grid.click();
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
});

test('pan and zoom cause zero React commits', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);

  const canvas = page.getByTestId('canvas-host').locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(centre.x, centre.y);
  const before = await page.evaluate(() => (window as AppWindow).__renderCount);

  await page.mouse.wheel(0, -240);
  await page.mouse.wheel(0, 120);

  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(centre.x + 80, centre.y + 40, { steps: 5 });
  await page.mouse.up({ button: 'middle' });

  const after = await page.evaluate(() => (window as AppWindow).__renderCount);
  expect(after).toBe(before);
});
