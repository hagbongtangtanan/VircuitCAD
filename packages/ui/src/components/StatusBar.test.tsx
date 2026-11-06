import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { StatusBar } from './StatusBar';

afterEach(cleanup);

it('shows counts, zoom and hint', () => {
  render(<StatusBar partCount={3} wireCount={2} zoom={1.5} hint="ready" />);

  expect(screen.getByTestId('status-parts').textContent).toBe('3 parts');
  expect(screen.getByTestId('status-wires').textContent).toBe('2 wires');
  expect(screen.getByTestId('status-zoom').textContent).toBe('150%');
  expect(screen.getByTestId('status-hint').textContent).toBe('ready');
});
