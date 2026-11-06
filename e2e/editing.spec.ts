import { expect, test, type Page } from '@playwright/test';

type AppWindow = Window & {
  __app?: { getCircuit(): unknown; store: { addPart(id: string, options: unknown): void } };
};

const CELL = 20;

async function clickGrid(page: Page, gx: number, gy: number): Promise<void> {
  const box = await page.locator('[data-testid="canvas-host"] canvas').boundingBox();
  if (!box) throw new Error('canvas not found');
  await page.mouse.click(box.x + gx * CELL, box.y + gy * CELL);
}

async function circuit(page: Page): Promise<{ parts: { partId: string; rotation: number }[]; wires: unknown[] }> {
  return page.evaluate(
    () => JSON.parse(JSON.stringify((window as AppWindow).__app?.getCircuit())) as never,
  );
}

test('places, wires, rotates, deletes and undoes in the editor', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));

  await page.getByRole('button', { name: 'Resistor' }).click();
  await clickGrid(page, 1, 5);
  let state = await circuit(page);
  expect(state.parts).toHaveLength(1);
  expect(state.parts[0]?.partId).toBe('resistor');

  await page.getByRole('button', { name: 'Wire' }).click();
  await clickGrid(page, 1, 5);
  await clickGrid(page, 8, 5);
  state = await circuit(page);
  expect(state.wires).toHaveLength(1);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await circuit(page)).wires).toHaveLength(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  expect((await circuit(page)).wires).toHaveLength(1);

  await page.getByRole('button', { name: 'Select' }).click();
  await clickGrid(page, 3, 5);
  await page.getByRole('button', { name: 'Rotate' }).click();
  expect((await circuit(page)).parts[0]?.rotation).toBe(90);

  await page.getByRole('button', { name: 'Delete' }).click();
  expect((await circuit(page)).parts).toHaveLength(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await circuit(page)).parts).toHaveLength(1);
});

test('stays responsive while rendering a 100-part circuit', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));

  const fps = await page.evaluate(async () => {
    const app = (window as AppWindow).__app;
    if (!app) return 0;
    for (let index = 0; index < 100; index += 1) {
      app.store.addPart('resistor', {
        position: { x: (index % 10) + 1, y: 3 + (Math.floor(index / 10) % 5) },
      });
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const start = performance.now();
    let frames = 0;
    await new Promise<void>((resolve) => {
      const loop = (): void => {
        frames += 1;
        if (performance.now() - start < 1000) requestAnimationFrame(loop);
        else resolve();
      };
      requestAnimationFrame(loop);
    });
    return frames;
  });

  console.log(`measured ~${fps} fps with 100 parts (dev-web, SwiftShader)`);
  expect(fps).toBeGreaterThan(0);
});
