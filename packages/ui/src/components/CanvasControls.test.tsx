import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { CanvasControls, type CanvasViewport } from './CanvasControls';

afterEach(cleanup);

function makeViewport() {
  const listeners = new Set<() => void>();
  let scale = 1;
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    zoomByCentre: vi.fn((factor: number) => {
      scale *= factor;
      notify();
    }),
    resetZoom: vi.fn(() => {
      scale = 1;
      notify();
    }),
    fitToContent: vi.fn(),
    setGridVisible: vi.fn(),
    isGridVisible: () => true,
    getViewport: () => ({ scale }),
    onViewportChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies CanvasViewport;
}

it('renders zoom, fit, reset and grid controls', () => {
  render(<CanvasControls viewport={makeViewport()} />);
  for (const name of ['Zoom out', 'Zoom in', 'Fit to content', 'Reset zoom', 'Toggle grid']) {
    expect(screen.getByRole('button', { name }), name).toBeTruthy();
  }
  expect(screen.getByTestId('canvas-zoom').textContent).toBe('100%');
});

it('drives the viewport and updates the percent label imperatively', () => {
  const viewport = makeViewport();
  render(<CanvasControls viewport={viewport} />);

  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  expect(viewport.zoomByCentre).toHaveBeenCalled();
  expect(screen.getByTestId('canvas-zoom').textContent).toBe('120%');

  fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
  expect(viewport.resetZoom).toHaveBeenCalled();
  expect(screen.getByTestId('canvas-zoom').textContent).toBe('100%');

  fireEvent.click(screen.getByRole('button', { name: 'Fit to content' }));
  expect(viewport.fitToContent).toHaveBeenCalled();
});

it('toggles the grid', () => {
  const viewport = makeViewport();
  render(<CanvasControls viewport={viewport} />);
  const toggle = screen.getByRole('button', { name: 'Toggle grid' });
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(toggle);
  expect(viewport.setGridVisible).toHaveBeenCalledWith(false);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
});
