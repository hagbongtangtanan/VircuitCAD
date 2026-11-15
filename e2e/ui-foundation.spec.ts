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
  __vcClickCount?: number;
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
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
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
  const board = await page.evaluate(() => (window as AppWindow).__editor?.getBoardScreenBounds());
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
    expect(hintBox.right, `hint right at ${viewport.width}`).toBeLessThanOrEqual(
      canvas.x + canvas.width,
    );
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
    expect(
      contrast(parsedRgb(colours.color), parsedRgb(colours.backgroundColor)),
    ).toBeGreaterThanOrEqual(4.5);
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
    const fillRatio = Math.max(board.width, board.height) / limitingCanvasDimension;
    const scale = await page.evaluate(
      () => (window as AppWindow).__editor?.getViewport().scale ?? 0,
    );

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

  const canvas = await page.getByTestId('canvas-host').locator('canvas');
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

test('the parts panel has compact unwrapped headers, uniform rows, and art thumbnails', async ({
  page,
}) => {
  await ready(page);

  const searchRow = page.locator('.parts-bin-search');
  const searchInput = page.getByLabel('Search parts');
  const searchRowBox = await searchRow.boundingBox();
  const searchInputBox = await searchInput.boundingBox();
  expect(searchRowBox).not.toBeNull();
  expect(searchInputBox).not.toBeNull();
  expect(searchInputBox?.width).toBeCloseTo(searchRowBox?.width ?? 0, 0);

  const headerMetrics = await page
    .locator('.parts-bin-toggle, .parts-category-toggle')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
    );
  expect(headerMetrics.length).toBeGreaterThan(1);
  for (const metric of headerMetrics) {
    expect(metric.whiteSpace).toBe('nowrap');
    expect(metric.scrollHeight).toBeLessThanOrEqual(metric.clientHeight + 1);
  }

  const rowHeights = await page
    .locator('.part-row')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(rowHeights.length).toBeGreaterThan(0);
  expect(new Set(rowHeights)).toEqual(new Set([32]));

  const rows = page.locator('.part-row');
  const thumbnails = page.locator('[data-testid="part-thumbnail"]');
  await expect(thumbnails).toHaveCount(await rows.count());
  for (const thumbnail of await thumbnails.all()) {
    expect(await thumbnail.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  }
});

test('parts remain reachable with the keyboard in visual order', async ({ page }) => {
  await ready(page);
  const search = page.getByLabel('Search parts');
  const planned = page.getByLabel('Show planned');
  const category = page.locator('.parts-category-toggle').first();
  const firstPart = page.locator('.part-row').first();

  await search.focus();
  await page.keyboard.press('Tab');
  await expect(planned).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(category).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstPart).toBeFocused();
});

test('the inspector contains only selection details with an equal-width unwrapped summary', async ({
  page,
}) => {
  await ready(page);
  const inspector = page.getByTestId('right-panel');

  await expect(inspector.locator('[data-testid="code-editor"]')).toHaveCount(0);
  await expect(inspector.locator('[data-testid="serial-lines"]')).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Build' })).toHaveCount(0);
  await expect(inspector.getByRole('button', { name: 'Send' })).toHaveCount(0);

  const labels = inspector.locator('.inspector-summary dt');
  const widths = await labels.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().width),
  );
  expect(widths.length).toBeGreaterThan(1);
  expect(new Set(widths.map((width) => width.toFixed(2))).size).toBe(1);

  const wrappedLabels = await labels.evaluateAll(
    (elements) =>
      elements.filter(
        (element) =>
          element.scrollHeight > element.clientHeight + 1 ||
          getComputedStyle(element).whiteSpace !== 'nowrap',
      ).length,
  );
  expect(wrappedLabels).toBe(0);
  await expect(inspector.getByLabel('Breadboard: Full size')).toBeVisible();
});

test('the code button opens a collapsible tabbed bottom dock', async ({ page }) => {
  await ready(page);
  await expect(page.getByTestId('bottom-dock')).toHaveCount(0);

  await page.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByTestId('bottom-dock')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Serial' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Problems' })).toBeVisible();

  await page.getByRole('button', { name: 'Collapse bottom dock' }).click();
  await expect(page.getByTestId('bottom-dock')).toHaveCount(0);
});

test('the serial monitor keeps two unwrapped rows with equal 28 px controls', async ({ page }) => {
  for (const width of [600, 900, 1400]) {
    await page.setViewportSize({ width, height: 800 });
    await ready(page);
    await page.getByRole('button', { name: 'Code' }).click();
    await page.getByRole('tab', { name: 'Serial' }).click();

    const dock = page.getByTestId('bottom-dock');
    const dockBox = await dock.boundingBox();
    expect(dockBox?.width, `dock width at ${width}`).toBeCloseTo(width, 0);

    const controls = [
      page.getByRole('checkbox', { name: 'Auto-scroll' }),
      page.getByRole('combobox', { name: 'Line ending' }),
      page.getByRole('button', { name: 'Clear' }),
      page.getByRole('textbox', { name: 'Send' }),
      page.getByRole('button', { name: 'Send' }),
    ];
    const boxes = await Promise.all(
      controls.map(async (control) => {
        const box = await control.boundingBox();
        if (!box) throw new Error(`serial control has no bounding box at ${width}`);
        return withEdges(box);
      }),
    );

    for (const box of boxes) {
      expect(box.height, `serial control height at ${width}`).toBeCloseTo(28, 0);
    }
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        expect(
          intersects(boxes[first] as Box, boxes[second] as Box),
          `serial controls overlap at ${width}`,
        ).toBe(false);
      }
    }

    const firstRow = await page.getByTestId('serial-control-row').boundingBox();
    const secondRow = await page.getByTestId('serial-send-row').boundingBox();
    expect(firstRow?.height, `first serial row at ${width}`).toBeCloseTo(28, 0);
    expect(secondRow?.height, `second serial row at ${width}`).toBeCloseTo(28, 0);
    expect(secondRow?.y, `serial rows wrap at ${width}`).toBeGreaterThan(firstRow?.y ?? 0);
  }
});

test('toolbar controls are uniformly 32 px and disabled controls dispatch no click', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await ready(page);

  const toolbar = page.getByTestId('app-toolbar');
  const metrics = await toolbar.locator('button').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, center: rect.top + rect.height / 2 };
    }),
  );
  expect(metrics.length).toBeGreaterThan(4);
  for (const metric of metrics) expect(metric.height).toBeCloseTo(32, 0);
  expect(new Set(metrics.map((metric) => metric.center.toFixed(2))).size).toBe(1);

  for (const name of ['Code', 'Run', 'Pause', 'Stop']) {
    const button = toolbar.getByRole('button', { name, exact: true });
    const box = await button.boundingBox();
    expect(box?.height, `${name} toolbar height`).toBeCloseTo(32, 0);
  }

  await page.evaluate(() => {
    (window as AppWindow).__vcClickCount = 0;
    document.addEventListener('click', () => {
      (window as AppWindow).__vcClickCount = (window as AppWindow).__vcClickCount ?? 0;
      (window as AppWindow).__vcClickCount += 1;
    });
  });

  const pause = toolbar.getByRole('button', { name: 'Pause', exact: true });
  const stop = toolbar.getByRole('button', { name: 'Stop', exact: true });
  await expect(pause).toBeDisabled();
  await expect(stop).toBeDisabled();
  await expect(pause).toHaveAttribute('title', /simulation is running/i);
  await expect(stop).toHaveAttribute('title', /simulation is running/i);
  await pause.evaluate((element) => (element as HTMLButtonElement).click());
  await stop.evaluate((element) => (element as HTMLButtonElement).click());

  await page.getByRole('button', { name: 'Code' }).click();
  await page.getByRole('tab', { name: 'Serial' }).click();
  await page.evaluate(() => {
    (window as AppWindow).__vcClickCount = 0;
  });
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  await expect(send).toHaveAttribute('title', /Sending serial data is not available/);
  await send.evaluate((element) => (element as HTMLButtonElement).click());

  expect(await page.evaluate(() => (window as AppWindow).__vcClickCount)).toBe(0);
});
