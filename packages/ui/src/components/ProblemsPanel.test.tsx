import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ProblemsPanel } from './ProblemsPanel';

afterEach(cleanup);

it('shows an empty state', () => {
  render(<ProblemsPanel problems={[]} />);
  expect(screen.getByText('No problems')).toBeTruthy();
});

it('lists problems and jumps on click', () => {
  const onSelect = vi.fn();
  render(
    <ProblemsPanel
      onSelect={onSelect}
      problems={[
        { file: 'sketch.ino', line: 3, column: 5, severity: 'error', message: "expected ';'" },
      ]}
    />,
  );
  const item = screen.getByText(/expected ';'/);
  fireEvent.click(item);
  expect(onSelect).toHaveBeenCalledWith({
    file: 'sketch.ino',
    line: 3,
    column: 5,
    severity: 'error',
    message: "expected ';'",
  });
});
