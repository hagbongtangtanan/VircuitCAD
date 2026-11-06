import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { Toolbar } from './Toolbar';

afterEach(cleanup);

it('reports tool changes and actions, and reflects history state', () => {
  const onTool = vi.fn();
  const onRotate = vi.fn();
  const onDelete = vi.fn();
  const onDuplicate = vi.fn();
  const onUndo = vi.fn();
  const onRedo = vi.fn();

  render(
    <Toolbar
      tool="select"
      onTool={onTool}
      canUndo
      canRedo={false}
      onUndo={onUndo}
      onRedo={onRedo}
      onRotate={onRotate}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />,
  );

  fireEvent.click(screen.getByText('Wire'));
  expect(onTool).toHaveBeenCalledWith('wire');

  fireEvent.click(screen.getByText('Rotate'));
  expect(onRotate).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText('Delete'));
  expect(onDelete).toHaveBeenCalledTimes(1);

  expect(screen.getByText('undo:yes redo:no')).toBeTruthy();
});
