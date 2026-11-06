import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { createDefaultPartRegistry, createPartInstance } from '@vircuitcad/core';

import { Inspector } from './Inspector';

afterEach(cleanup);

it('edits a numeric param and rejects out-of-range values', () => {
  const onChange = vi.fn();
  const part = createPartInstance('resistor', { id: 'r1' });
  render(
    <Inspector registry={createDefaultPartRegistry()} part={part} onChange={onChange} />,
  );

  const input = screen.getByLabelText('Resistance');
  fireEvent.change(input, { target: { value: '470' } });
  expect(onChange).toHaveBeenCalledWith('resistance', 470);

  onChange.mockClear();
  fireEvent.change(input, { target: { value: '0' } });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('Minimum');
});

it('edits a string param', () => {
  const onChange = vi.fn();
  const part = createPartInstance('led', { id: 'd1' });
  render(<Inspector registry={createDefaultPartRegistry()} part={part} onChange={onChange} />);

  fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'green' } });
  expect(onChange).toHaveBeenCalledWith('color', 'green');
});

it('shows an empty state without a selection', () => {
  render(
    <Inspector registry={createDefaultPartRegistry()} part={undefined} onChange={() => {}} />,
  );
  expect(screen.getByText('No selection')).toBeTruthy();
});
