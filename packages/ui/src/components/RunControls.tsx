import { defaultCapabilities, unavailableReason, type Capabilities } from '@vircuitcad/core';

export type SimRunState = 'idle' | 'running' | 'paused' | 'stopped';

export type RunControlsProps = {
  state: SimRunState;
  onRun: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  capabilities?: Capabilities;
};

export function RunControls({
  state,
  onRun,
  onTogglePause,
  onStop,
  capabilities = defaultCapabilities(),
}: RunControlsProps) {
  const active = state === 'running' || state === 'paused';
  const reason = capabilities.simulation ? undefined : unavailableReason('simulation');

  return (
    <div className="run-controls" role="group" aria-label="Simulation">
      <button type="button" onClick={onRun} disabled={!capabilities.simulation} title={reason}>
        {state === 'running' ? 'Restart' : 'Run'}
      </button>
      <button
        type="button"
        onClick={onTogglePause}
        disabled={!capabilities.simulation || !active}
        title={reason}
      >
        {state === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={!capabilities.simulation || state === 'idle' || state === 'stopped'}
        title={reason}
      >
        Stop
      </button>
    </div>
  );
}
