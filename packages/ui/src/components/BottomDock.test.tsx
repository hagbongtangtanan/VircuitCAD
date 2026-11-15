import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { BottomDock } from './BottomDock';

afterEach(cleanup);

it('is collapsed by default and exposes Code, Serial, and Problems tabs', () => {
  render(
    <BottomDock
      open={false}
      activeTab="code"
      onTabChange={() => {}}
      onClose={() => {}}
      code={<div>Code content</div>}
      serial={<div>Serial content</div>}
      problems={<div>Problems content</div>}
    />,
  );

  expect(screen.queryByTestId('bottom-dock')).toBeNull();
});

it('shows one tab panel at a time and collapses on request', () => {
  const onTabChange = vi.fn();
  const onClose = vi.fn();
  render(
    <BottomDock
      open
      activeTab="code"
      onTabChange={onTabChange}
      onClose={onClose}
      code={<div>Code content</div>}
      serial={<div>Serial content</div>}
      problems={<div>Problems content</div>}
    />,
  );

  expect(screen.getByRole('tab', { name: 'Code' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('Code content')).toBeTruthy();
  expect(screen.queryByText('Serial content')).toBeNull();

  fireEvent.click(screen.getByRole('tab', { name: 'Serial' }));
  expect(onTabChange).toHaveBeenCalledWith('serial');

  fireEvent.click(screen.getByRole('button', { name: 'Collapse bottom dock' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
