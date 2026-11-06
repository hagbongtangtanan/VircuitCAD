import { expect, test } from '@playwright/test';

type EditorWindow = Window & { __editor?: { getViewport(): { scale: number } } };

test('editor mounts a canvas and wheel zoom changes the viewport scale', async ({ page }) => {
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const scaleOf = (): Promise<number> =>
    page.evaluate(() => (window as EditorWindow).__editor?.getViewport().scale ?? 0);

  const before = await scaleOf();
  expect(before).toBeGreaterThan(0);

  await canvas.hover();
  await page.mouse.wheel(0, -400);
  await page.waitForFunction(
    (initial) => ((window as EditorWindow).__editor?.getViewport().scale ?? 0) > initial,
    before,
  );

  expect(await scaleOf()).toBeGreaterThan(before);
});
