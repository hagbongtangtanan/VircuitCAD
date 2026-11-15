import { expect, test } from '@playwright/test';

import packageJson from '../package.json' with { type: 'json' };

test('the status bar displays the package version', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('version')).toHaveText(`v${packageJson.version}`);
});
