import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { RunControls } from './RunControls';

afterEach(cleanup);

it('fires run, pause toggle and stop', () => {
  const onRun = vi.fn();
  const onTogglePause = vi.fn();
  const onStop = vi.fn();
  render(
    <RunControls state="running" onRun={onRun} onTogglePause={onTogglePause} onStop={onStop} />,
  );

  fireEvent.click(screen.getByText('Restart'));
  expect(onRun).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Pause'));
  expect(onTogglePause).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Stop'));
  expect(onStop).toHaveBeenCalledTimes(1);
});

it('disables pause and stop while idle', () => {
  render(<RunControls state="idle" onRun={() => {}} onTogglePause={() => {}} onStop={() => {}} />);
  expect((screen.getByText('Pause') as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByText('Stop') as HTMLButtonElement).disabled).toBe(true);
});
