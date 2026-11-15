import { expect, test, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number; right: number; bottom: number };

type Rect = { x: number; y: number; width: number; height: number };

function withEdges(rect: Rect): Box {
  return { ...rect, right: rect.x + rect.width, bottom: rect.y + rect.height };
}

type AppWindow = Window & {
  __app?: {
    store: {
      addPart(id: string, options: unknown): void;
    };
  };
  __editor?: {
    getViewport(): { scale: number; x: number; y: number };
    getBoardScreenBounds(): { x: number; y: number; width: number; height: number };
  };
};

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as AppWindow).__app));
  await expect(page.getByTestId('canvas-host').locator('canvas')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => (window as AppWindow).__editor?.getBoardScreenBounds().width ?? 0),
    )
    .toBeGreaterThan(0);
}

function intersects(first: Box, second: Box): boolean {
  return (
    first.x < second.right &&
    first.right > second.x &&
    first.y < second.bottom &&
    first.bottom > second.y
  );
}

function luminance(rgb: readonly number[]): number {
  const channels = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(foreground: readonly number[], background: readonly number[]): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function parsedRgb(value: string): number[] {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) throw new Error(`invalid computed colour: ${value}`);
  return channels.slice(0, 3);
}

async function boardPageBox(page: Page): Promise<Box> {
  const canvas = await page.getByTestId('canvas-host').boundingBox();
  if (!canvas) throw new Error('canvas host has no bounding box');
  const board = await page.evaluate(() =>
    (window as AppWindow).__editor?.getBoardScreenBounds(),
  );
  if (!board) throw new Error('editor has no board bounds');
  return withEdges({
    x: canvas.x + board.x,
    y: canvas.y + board.y,
    width: board.width,
    height: board.height,
  });
}

test('the empty-state hint is accessible, clear of the breadboard, and hides after placement', async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await ready(page);

    const hint = page.getByTestId('canvas-empty-hint');
    const controls = page.getByTestId('canvas-controls');
    const canvas = await page.getByTestId('canvas-host').boundingBox();
    if (!canvas) throw new Error('canvas host has no bounding box');

    await expect(hint).toBeVisible();
    const hintRect = await hint.boundingBox();
    const controlsRect = await controls.boundingBox();
    const boardBox = await boardPageBox(page);
    if (!hintRect || !controlsRect) throw new Error('overlay has no bounding box');
    const hintBox = withEdges(hintRect);
    const controlsBox = withEdges(controlsRect);

    expect(hintBox.x, `hint left at ${viewport.width}`).toBeGreaterThanOrEqual(canvas.x);
    expect(hintBox.right, `hint right at ${viewport.width}`).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(hintBox.y, `hint lower third at ${viewport.width}`).toBeGreaterThanOrEqual(
      canvas.y + canvas.height * (2 / 3),
    );
    expect(hintBox.bottom, `hint above controls at ${viewport.width}`).toBeLessThanOrEqual(
      controlsBox.y,
    );
    expect(intersects(hintBox, boardBox), `hint/board at ${viewport.width}`).toBe(false);

    const colours = await hint.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });
    expect(colours.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(contrast(parsedRgb(colours.color), parsedRgb(colours.backgroundColor))).toBeGreaterThanOrEqual(
      4.5,
    );
  }

  await page.evaluate(() =>
    (window as AppWindow).__app?.store.addPart('resistor', {
      position: { x: 5, y: 5 },
    }),
  );
  await expect(page.getByTestId('canvas-empty-hint')).toHaveCount(0);
});

test('the board is fitted and centered at the required viewport sizes', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await ready(page);

    const canvas = await page.getByTestId('canvas-host').boundingBox();
    if (!canvas) throw new Error('canvas host has no bounding box');
    const board = await boardPageBox(page);
    const boardCenter = { x: board.x + board.width / 2, y: board.y + board.height / 2 };
    const canvasCenter = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
    const centerDistance = Math.hypot(
      boardCenter.x - canvasCenter.x,
      boardCenter.y - canvasCenter.y,
    );
    const limitingCanvasDimension = Math.min(canvas.width, canvas.height);
    const fillRatio =
      Math.max(board.width, board.height) / limitingCanvasDimension;
    const scale = await page.evaluate(() => (window as AppWindow).__editor?.getViewport().scale ?? 0);

    expect(centerDistance, `board center at ${viewport.width}`).toBeLessThanOrEqual(8);
    expect(fillRatio, `board fill at ${viewport.width}`).toBeGreaterThanOrEqual(0.55);
    expect(fillRatio, `board fill at ${viewport.width}`).toBeLessThanOrEqual(0.85);
    expect(scale, `initial zoom at ${viewport.width}`).toBeGreaterThan(0);
    expect(scale, `initial zoom at ${viewport.width}`).toBeLessThanOrEqual(1);
  }
});

test('layout changes refit an untouched viewport but preserve a user-adjusted viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await ready(page);

  const scaleOf = (): Promise<number> =>
    page.evaluate(() => (window as AppWindow).__editor?.getViewport().scale ?? 0);
  const centered = async (): Promise<boolean> => {
    const canvas = await page.getByTestId('canvas-host').boundingBox();
    if (!canvas) return false;
    const board = await boardPageBox(page);
    return (
      Math.abs(board.x + board.width / 2 - (canvas.x + canvas.width / 2)) <= 8 &&
      Math.abs(board.y + board.height / 2 - (canvas.y + canvas.height / 2)) <= 8
    );
  };

  const initialScale = await scaleOf();
  const separator = page.getByTestId('separator-left');
  await separator.focus();
  await separator.press('ArrowRight');
  await expect.poll(scaleOf).toBeLessThan(initialScale);
  expect(await centered()).toBe(true);

  const resizedScale = await scaleOf();
  await page.getByRole('button', { name: 'Hide parts panel' }).click();
  await expect.poll(scaleOf).toBeGreaterThan(resizedScale);
  expect(await centered()).toBe(true);

  const canvas = page.getByTestId('canvas-host').locator('canvas');
  await canvas.hover();
  await page.mouse.wheel(0, -240);
  await expect.poll(scaleOf).toBeGreaterThan(resizedScale);
  const adjustedScale = await scaleOf();
  await page.getByRole('button', { name: 'Hide inspector panel' }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await scaleOf()).toBeCloseTo(adjustedScale, 5);
});
