import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { InstrumentPanel } from './InstrumentPanel';

afterEach(cleanup);

it('renders nothing without readings', () => {
  const { container } = render(<InstrumentPanel readings={[]} />);
  expect(container.querySelector('[aria-label="Instruments"]')).toBeNull();
});

it('shows meter values with units and dashes for unknown', () => {
  render(
    <InstrumentPanel
      readings={[
        { partId: 'm1', mode: 'V', value: 4.98, unit: 'V' },
        { partId: 'm2', mode: 'Ω', value: null, unit: 'Ω' },
      ]}
    />,
  );
  expect(screen.getByTestId('meter-m1').textContent).toContain('4.98');
  expect(screen.getByTestId('meter-m2').textContent).toContain('---');
});
