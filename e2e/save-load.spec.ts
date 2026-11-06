import { expect, test } from '@playwright/test';

type AppWindow = Window & {
  __app?: { getCircuit(): unknown; save(): Promise<void>; load(): Promise<void> };
};

test('saving and reloading restores an identical circuit', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));

  await page.evaluate(() => {
    const app = (window as AppWindow).__app;
    if (app) {
      const store = (app as unknown as { store: { addPart(id: string, options: unknown): void } })
        .store;
      store.addPart('resistor', { id: 'r1', position: { x: 0, y: 5 } });
    }
  });

  const before = await page.evaluate(() => JSON.stringify((window as AppWindow).__app?.getCircuit()));
  expect(before).toContain('resistor');

  await page.evaluate(() => (window as AppWindow).__app?.save());
  await page.reload();
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));
  await page.evaluate(() => (window as AppWindow).__app?.load());

  const after = await page.evaluate(() => JSON.stringify((window as AppWindow).__app?.getCircuit()));
  expect(after).toBe(before);
});
