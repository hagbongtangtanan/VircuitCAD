import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { Toolbar } from './Toolbar';

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const handlers = {
    onTool: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onRotate: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
  };
  render(
    <Toolbar
      tool="select"
      canUndo
      canRedo={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

it('exposes accessible, labelled icon buttons with tooltips', () => {
  setup();
  for (const label of ['Select', 'Wire', 'Rotate', 'Duplicate', 'Delete', 'Undo', 'Redo']) {
    const button = screen.getByRole('button', { name: label });
    expect(button.querySelector('svg'), `${label} has an icon`).toBeTruthy();
    expect(button.getAttribute('title'), `${label} has a tooltip`).toContain(label);
  }
});

it('reports tool changes and actions', () => {
  const handlers = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Wire' }));
  expect(handlers.onTool).toHaveBeenCalledWith('wire');
  fireEvent.click(screen.getByRole('button', { name: 'Rotate' }));
  expect(handlers.onRotate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(handlers.onDelete).toHaveBeenCalledTimes(1);
});

it('disables undo/redo according to history and shows no debug text', () => {
  setup({ canUndo: false, canRedo: true });
  expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Redo' }).hasAttribute('disabled')).toBe(false);
  expect(screen.queryByText(/undo:yes|undo:no/)).toBeNull();
});
