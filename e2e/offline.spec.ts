import { expect, test } from '@playwright/test';

test('dev-web stays offline, sets a CSP and renders the canvas', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') external.push(request.url());
  });

  await page.goto('/');

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('version')).toContainText('0.0.0');

  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("default-src 'self'");

  expect(external).toEqual([]);
});
