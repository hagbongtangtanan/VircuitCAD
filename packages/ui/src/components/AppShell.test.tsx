import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { AppShell, clampPanel, PANEL_MAX, PANEL_MIN } from './AppShell';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

function setup() {
  render(
    <AppShell
      toolbar={<span>tools</span>}
      left={<span>parts</span>}
      right={<span>inspector</span>}
      status={<span>status</span>}
    >
      <span>canvas</span>
    </AppShell>,
  );
}

it('lays out the five regions with default panel sizes', () => {
  setup();
  for (const id of [
    'app-shell',
    'app-toolbar',
    'left-panel',
    'app-main',
    'right-panel',
    'app-status',
  ]) {
    expect(screen.getByTestId(id), id).toBeTruthy();
  }
  expect((screen.getByTestId('left-panel') as HTMLElement).style.width).toBe('260px');
  expect((screen.getByTestId('right-panel') as HTMLElement).style.width).toBe('300px');
});

it('collapses and restores the side panels', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Hide parts panel' }));
  expect(screen.queryByTestId('left-panel')).toBeNull();
  expect(screen.getByTestId('left-rail')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Show parts panel' }));
  expect(screen.getByTestId('left-panel')).toBeTruthy();
  expect(screen.queryByTestId('left-rail')).toBeNull();
});

it('resizes with the keyboard and clamps to the allowed range', () => {
  setup();
  fireEvent.keyDown(screen.getByTestId('separator-left'), { key: 'ArrowLeft' });
  expect(screen.getByTestId('separator-left').getAttribute('aria-valuenow')).toBe('244');

  for (let index = 0; index < 40; index += 1) {
    fireEvent.keyDown(screen.getByTestId('separator-left'), { key: 'ArrowLeft' });
  }
  expect(screen.getByTestId('separator-left').getAttribute('aria-valuenow')).toBe(
    String(PANEL_MIN),
  );

  for (let index = 0; index < 40; index += 1) {
    fireEvent.keyDown(screen.getByTestId('separator-left'), { key: 'ArrowRight' });
  }
  expect(screen.getByTestId('separator-left').getAttribute('aria-valuenow')).toBe(
    String(PANEL_MAX),
  );
});

it('persists collapse state and panel widths to localStorage', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Hide inspector panel' }));
  const stored = JSON.parse(localStorage.getItem('vircuitcad.shell') ?? '{}') as {
    rightCollapsed?: boolean;
  };
  expect(stored.rightCollapsed).toBe(true);
});

it('clamps arbitrary widths into the panel range', () => {
  expect(clampPanel(1000)).toBe(PANEL_MAX);
  expect(clampPanel(10)).toBe(PANEL_MIN);
  expect(clampPanel(Number.NaN)).toBe(260);
});
