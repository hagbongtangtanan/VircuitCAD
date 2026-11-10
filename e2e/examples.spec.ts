import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

type AppWindow = Window & { __app?: { loadText(text: string): void } };

function loadExample(file: string): string {
  return readFileSync(fileURLToPath(new URL(`../examples/${file}`, import.meta.url)), 'utf8');
}

async function runExample(page: Page, file: string): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));
  const text = loadExample(file);
  await page.evaluate((value) => (window as AppWindow).__app?.loadText(value), text);
  await page.getByRole('button', { name: 'Run' }).click();
}

for (const file of [
  'led-resistor.vcad',
  'voltage-divider.vcad',
  'rc-charge.vcad',
  'switch-led.vcad',
  'rgb-led.vcad',
  'seven-segment.vcad',
]) {
  test(`loads and runs example ${file}`, async ({ page }) => {
    await runExample(page, file);
    await expect(page.getByTestId('status-sim')).toBeVisible();
    await expect(page.getByTestId('toast')).toHaveCount(0);
  });
}

test('voltage divider example reads ~4.5 V', async ({ page }) => {
  await runExample(page, 'voltage-divider.vcad');
  await expect(page.getByTestId('meter-m1')).toContainText('4.5');
});
