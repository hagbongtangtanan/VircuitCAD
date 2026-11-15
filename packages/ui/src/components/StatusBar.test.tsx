import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { StatusBar } from './StatusBar';

afterEach(cleanup);

it('shows counts, zoom and hint with separators', () => {
  const { container } = render(<StatusBar partCount={3} wireCount={2} zoom={1.5} hint="ready" />);

  expect(screen.getByTestId('status-parts').textContent).toBe('3 parts');
  expect(screen.getByTestId('status-wires').textContent).toBe('2 wires');
  expect(screen.getByTestId('status-zoom').textContent).toBe('150%');
  expect(screen.getByTestId('status-hint').textContent).toBe('ready');
  expect(container.querySelectorAll('.status-sep').length).toBeGreaterThanOrEqual(4);
});

it('shows the saved/unsaved indicator', () => {
  render(<StatusBar partCount={0} wireCount={0} saved={false} />);
  const indicator = screen.getByTestId('status-saved');
  expect(indicator.textContent).toContain('Unsaved changes');
  expect(indicator.className).toContain('is-dirty');
});

it('updates the zoom segment imperatively from the viewport', () => {
  const listeners = new Set<() => void>();
  let scale = 1;
  const viewport = {
    getViewport: () => ({ scale }),
    onViewportChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  render(<StatusBar partCount={0} wireCount={0} viewport={viewport} />);
  expect(screen.getByTestId('status-zoom').textContent).toBe('100%');
  scale = 2;
  for (const listener of listeners) listener();
  expect(screen.getByTestId('status-zoom').textContent).toBe('200%');
});
