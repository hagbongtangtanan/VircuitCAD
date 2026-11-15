import { defaultCapabilities, unavailableReason, type Capabilities } from '@vircuitcad/core';
import type { ReactNode } from 'react';

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
  const capabilityReason = capabilities.simulation ? undefined : unavailableReason('simulation');

  return (
    <div className="run-controls" role="group" aria-label="Simulation">
      <button
        type="button"
        onClick={onRun}
        disabled={!capabilities.simulation}
        title={capabilityReason ?? 'Run simulation'}
      >
        {state === 'running' ? 'Restart' : 'Run'}
      </button>
      <button
        type="button"
        onClick={onTogglePause}
        disabled={!capabilities.simulation || !active}
        title={
          capabilityReason ??
          (state === 'paused'
            ? 'Resume simulation'
            : 'Pause is unavailable until the simulation is running')
        }
      >
        {state === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={!capabilities.simulation || state === 'idle' || state === 'stopped'}
        title={capabilityReason ?? 'Stop is unavailable until the simulation is running'}
      >
        Stop
      </button>
    </div>
  );
}

export type CodeActionsProps = {
  onBuild: () => void;
  onStop: () => void;
  capabilities?: Capabilities;
  children?: ReactNode;
};

export function CodeActions({
  onBuild,
  onStop,
  capabilities = defaultCapabilities(),
  children,
}: CodeActionsProps) {
  return (
    <div className="bottom-dock-actions" role="group" aria-label="Code actions">
      <button
        type="button"
        onClick={onBuild}
        disabled={!capabilities.compile}
        title={capabilities.compile ? 'Build sketch' : unavailableReason('compile')}
      >
        Build
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={!capabilities.codeActions}
        title={
          capabilities.codeActions ? 'Stop the running sketch' : unavailableReason('codeActions')
        }
      >
        Stop
      </button>
      {children}
    </div>
  );
}
