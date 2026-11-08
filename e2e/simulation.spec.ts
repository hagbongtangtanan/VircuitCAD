import { expect, test } from '@playwright/test';

type AppWindow = Window & {
  __app?: {
    store: {
      addPart(id: string, options: unknown): void;
      addWire(from: unknown, to: unknown): void;
    };
  };
};

test('shows an error toast for a shorted battery', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));

  await page.evaluate(() => {
    const app = (window as AppWindow).__app;
    if (!app) return;
    app.store.addPart('battery', {
      id: 'bt1',
      position: { x: 0, y: 20 },
      params: { voltage: 9 },
    });
    app.store.addWire(
      { kind: 'pin', partId: 'bt1', pinId: 'positive' },
      { kind: 'pin', partId: 'bt1', pinId: 'negative' },
    );
  });

  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByTestId('toast')).toBeVisible();
  await expect(page.getByTestId('toast')).toContainText(/short|loop|converge/i);
});
