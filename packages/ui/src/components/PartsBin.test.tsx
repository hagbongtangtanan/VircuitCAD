import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { createDefaultPartRegistry } from '@vircuitcad/core';

import { PartsBin } from './PartsBin';

afterEach(cleanup);

it('lists parts by category and picks one', () => {
  const onPick = vi.fn();
  render(<PartsBin registry={createDefaultPartRegistry()} onPick={onPick} />);

  expect(screen.getByText('Resistor')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'passive' })).toBeTruthy();

  fireEvent.click(screen.getByText('LED'));
  expect(onPick).toHaveBeenCalledWith('led');
});

it('filters parts by the search query', () => {
  render(<PartsBin registry={createDefaultPartRegistry()} onPick={() => {}} />);

  fireEvent.change(screen.getByLabelText('Search parts'), { target: { value: 'bat' } });
  expect(screen.queryByText('Resistor')).toBeNull();
  expect(screen.getByText('Battery')).toBeTruthy();
});
