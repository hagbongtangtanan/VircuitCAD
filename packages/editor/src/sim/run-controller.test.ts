import { expect, it, vi } from 'vitest';

import { RunController, type CompileOutcome } from './run-controller';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

it('compiles then runs with the hex', async () => {
  const onStart = vi.fn();
  const controller = new RunController({
    compile: async (): Promise<CompileOutcome> => ({ ok: true, hex: ':hex', diagnostics: [] }),
    onStart,
    onStop: () => {},
  });
  await controller.build();
  expect(controller.getState()).toBe('running');
  expect(onStart).toHaveBeenCalledWith(':hex');
});

it('reports a compile error', async () => {
  const controller = new RunController({
    compile: async (): Promise<CompileOutcome> => ({
      ok: false,
      diagnostics: [{ severity: 'error', message: 'boom' }],
    }),
    onStart: () => {},
    onStop: () => {},
  });
  await controller.build();
  expect(controller.getState()).toBe('error');
});

it('drops a stale compile result after stop', async () => {
  const gate = deferred<CompileOutcome>();
  const onStart = vi.fn();
  const onStop = vi.fn();
  const controller = new RunController({
    compile: () => gate.promise,
    onStart,
    onStop,
  });

  const building = controller.build();
  expect(controller.getState()).toBe('compiling');
  controller.stop();
  gate.resolve({ ok: true, hex: ':hex', diagnostics: [] });
  await building;

  expect(controller.getState()).toBe('idle');
  expect(onStart).not.toHaveBeenCalled();
  expect(onStop).toHaveBeenCalledTimes(1);
});

it('cancels a compile in progress', () => {
  const controller = new RunController({
    compile: () => new Promise(() => {}),
    onStart: () => {},
    onStop: () => {},
  });
  void controller.build();
  controller.cancel();
  expect(controller.getState()).toBe('idle');
});

it('flags edits made while running', async () => {
  const controller = new RunController({
    compile: async () => ({ ok: true, hex: ':hex', diagnostics: [] }),
    onStart: () => {},
    onStop: () => {},
  });
  expect(controller.markEdited()).toBe(false);
  await controller.build();
  expect(controller.markEdited()).toBe(true);
  expect(controller.isDirty).toBe(true);
});
