import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { Toast } from './Toast';

afterEach(cleanup);

it('renders nothing without a message', () => {
  const { container } = render(<Toast message={undefined} />);
  expect(container.querySelector('[data-testid="toast"]')).toBeNull();
});

it('shows the message and dismisses', () => {
  const onDismiss = vi.fn();
  render(<Toast message="Short circuit near a node" onDismiss={onDismiss} />);
  expect(screen.getByTestId('toast').textContent).toContain('Short circuit');
  fireEvent.click(screen.getByLabelText('Dismiss'));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
