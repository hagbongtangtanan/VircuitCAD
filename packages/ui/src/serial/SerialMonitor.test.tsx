import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { SerialMonitor } from './SerialMonitor';

afterEach(cleanup);

const sendEnabled = {
  simulation: true,
  codeEditor: true,
  codeActions: true,
  compile: true,
  serialSend: true,
};

it('renders lines and sends with the chosen line ending', () => {
  const onSend = vi.fn();
  render(
    <SerialMonitor
      lines={[{ text: 'hello', timestamp: 1500 }]}
      onSend={onSend}
      capabilities={sendEnabled}
    />,
  );

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

it('disables sending with a reason and dispatches nothing without the capability', () => {
  const onSend = vi.fn();
  render(<SerialMonitor lines={[]} onSend={onSend} />);

  const input = screen.getByRole('textbox', { name: 'Send' }) as HTMLInputElement;
  const button = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
  expect(input.disabled).toBe(true);
  expect(button.disabled).toBe(true);
  expect(button.title).toMatch(/Sending serial data is not available/);

  fireEvent.change(input, { target: { value: 'ping' } });
  fireEvent.submit(button.closest('form') as HTMLFormElement);
  fireEvent.click(button);
  expect(onSend).not.toHaveBeenCalled();
});
