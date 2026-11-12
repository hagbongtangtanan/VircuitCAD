import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { WireColorPicker } from './WireColorPicker';

afterEach(cleanup);

it('renders the eight-colour palette and marks the active colour', () => {
  render(<WireColorPicker color="#22c55e" onChange={() => {}} />);
  expect(screen.getAllByRole('button')).toHaveLength(8);
  expect(screen.getByRole('button', { name: 'Wire colour green' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(screen.getByRole('button', { name: 'Wire colour red' }).getAttribute('aria-pressed')).toBe(
    'false',
  );
});

it('reports the chosen colour', () => {
  const onChange = vi.fn();
  render(<WireColorPicker color="#22c55e" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Wire colour red' }));
  expect(onChange).toHaveBeenCalledWith('#ef4444');
});
