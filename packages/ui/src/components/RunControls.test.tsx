import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { CodeActions, RunControls } from './RunControls';

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

it('disables everything with a reason when simulation is unavailable', () => {
  render(
    <RunControls
      state="running"
      onRun={() => {}}
      onTogglePause={() => {}}
      onStop={() => {}}
      capabilities={{
        simulation: false,
        codeEditor: true,
        codeActions: true,
        compile: true,
        serialSend: false,
      }}
    />,
  );
  for (const label of ['Restart', 'Pause', 'Stop']) {
    const button = screen.getByText(label) as HTMLButtonElement;
    expect(button.disabled, label).toBe(true);
    expect(button.title, label).toMatch(/Simulation is not available/);
  }
});

it('dispatches nothing when simulation controls are unavailable', () => {
  const onRun = vi.fn();
  const onTogglePause = vi.fn();
  const onStop = vi.fn();
  render(
    <RunControls
      state="running"
      onRun={onRun}
      onTogglePause={onTogglePause}
      onStop={onStop}
      capabilities={{
        simulation: false,
        codeEditor: true,
        codeActions: true,
        compile: true,
        serialSend: false,
      }}
    />,
  );

  fireEvent.click(screen.getByText('Restart'));
  fireEvent.click(screen.getByText('Pause'));
  fireEvent.click(screen.getByText('Stop'));
  expect(onRun).not.toHaveBeenCalled();
  expect(onTogglePause).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
});

it('gates code actions with capability reasons and dispatches nothing when unavailable', () => {
  const onBuild = vi.fn();
  const onStop = vi.fn();
  render(
    <CodeActions
      onBuild={onBuild}
      onStop={onStop}
      capabilities={{
        simulation: true,
        codeEditor: true,
        codeActions: false,
        compile: false,
        serialSend: false,
      }}
    />,
  );

  const build = screen.getByRole('button', { name: 'Build' }) as HTMLButtonElement;
  const stop = screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement;
  expect(build.disabled).toBe(true);
  expect(build.title).toMatch(/Compiling is not available/);
  expect(stop.disabled).toBe(true);
  expect(stop.title).toMatch(/Code actions are not available/);

  fireEvent.click(build);
  fireEvent.click(stop);
  expect(onBuild).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
});

it('keeps enabled code actions working', () => {
  const onBuild = vi.fn();
  const onStop = vi.fn();
  render(<CodeActions onBuild={onBuild} onStop={onStop} />);

  fireEvent.click(screen.getByRole('button', { name: 'Build' }));
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(onBuild).toHaveBeenCalledTimes(1);
  expect(onStop).toHaveBeenCalledTimes(1);
});
