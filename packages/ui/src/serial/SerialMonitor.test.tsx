import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { SerialMonitor } from './SerialMonitor';

afterEach(cleanup);

it('renders lines and sends with the chosen line ending', () => {
  const onSend = vi.fn();
  render(<SerialMonitor lines={[{ text: 'hello', timestamp: 1500 }]} onSend={onSend} />);

  expect(screen.getByTestId('serial-lines').textContent).toContain('hello');
  expect(screen.getByTestId('serial-lines').textContent).toContain('1.500');

  fireEvent.change(screen.getByLabelText('Send'), { target: { value: 'ping' } });
  const form = screen.getByText('Send').closest('form');
  if (form) fireEvent.submit(form);
  expect(onSend).toHaveBeenCalledWith('ping\n');
});

it('clears via the button', () => {
  const onClear = vi.fn();
  render(<SerialMonitor lines={[]} onClear={onClear} />);
  fireEvent.click(screen.getByText('Clear'));
  expect(onClear).toHaveBeenCalledTimes(1);
});
