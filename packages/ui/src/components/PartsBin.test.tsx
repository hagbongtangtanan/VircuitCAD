import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { createDefaultPartRegistry, parsePartManifest } from '@vircuitcad/core';
import type { PartRegistry } from '@vircuitcad/core';

import { PartsBin } from './PartsBin';

function registryWithPlanned(): PartRegistry {
  const registry = createDefaultPartRegistry();
  registry.register(
    parsePartManifest({
      id: 'future-chip',
      name: 'Future Chip',
      category: 'digital',
      pins: [{ id: 'a', name: 'A', position: { x: 0, y: 0 }, role: 'passive' }],
      params: [],
      simModel: 'none',
      svg: 'parts/future.svg',
      status: 'planned',
    }),
  );
  return registry;
}

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

it('hides planned parts until "Show planned", then cannot place them', () => {
  const onPick = vi.fn();
  render(<PartsBin registry={registryWithPlanned()} onPick={onPick} />);

  expect(screen.queryByText('Future Chip')).toBeNull();

  fireEvent.click(screen.getByLabelText('Show planned'));
  const button = screen.getByRole('button', { name: 'Future Chip' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.title).toMatch(/Planned/);

  fireEvent.click(button);
  expect(onPick).not.toHaveBeenCalled();
});

it('collapses a category accordion with a count', () => {
  render(<PartsBin registry={createDefaultPartRegistry()} onPick={() => {}} />);
  const header = screen.getByRole('button', { name: /^passive \(/ });
  expect(header.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(header);
  expect(header.getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById('parts-passive')?.hasAttribute('hidden')).toBe(true);
});
