import { expect, test } from '@playwright/test';

type AppWindow = Window & { __app?: unknown };

test('code editor loads offline and Build produces a result', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') external.push(request.url());
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));

  await page.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByTestId('code-editor')).toBeVisible();

  await page.getByRole('button', { name: 'Build' }).click();
  await expect(page.getByTestId('run-state')).toHaveText(/running|error/, { timeout: 180_000 });

  expect(external).toEqual([]);
});
