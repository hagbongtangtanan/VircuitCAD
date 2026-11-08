export type SimRunState = 'idle' | 'running' | 'paused' | 'stopped';

export type RunControlsProps = {
  state: SimRunState;
  onRun: () => void;
  onTogglePause: () => void;
  onStop: () => void;
};

export function RunControls({ state, onRun, onTogglePause, onStop }: RunControlsProps) {
  const active = state === 'running' || state === 'paused';
  return (
    <div className="run-controls" role="group" aria-label="Simulation">
      <button type="button" onClick={onRun}>
        {state === 'running' ? 'Restart' : 'Run'}
      </button>
      <button type="button" onClick={onTogglePause} disabled={!active}>
        {state === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button type="button" onClick={onStop} disabled={state === 'idle' || state === 'stopped'}>
        Stop
      </button>
    </div>
  );
}
