export type StatusBarProps = {
  partCount: number;
  wireCount: number;
  zoom: number;
  hint?: string;
  simState?: string;
  simTime?: number;
  version?: string;
};

export function StatusBar({
  partCount,
  wireCount,
  zoom,
  hint,
  simState,
  simTime,
  version,
}: StatusBarProps) {
  return (
    <div className="status-bar" role="status">
      <span data-testid="status-parts">{partCount} parts</span>
      <span data-testid="status-wires">{wireCount} wires</span>
      <span data-testid="status-zoom">{Math.round(zoom * 100)}%</span>
      {simState && simState !== 'idle' ? (
        <span data-testid="status-sim">
          {simState}
          {simTime !== undefined ? ` ${(simTime * 1000).toFixed(0)} ms` : ''}
        </span>
      ) : null}
      {hint ? <span data-testid="status-hint">{hint}</span> : null}
      {version ? (
        <span className="version" data-testid="version">
          v{version}
        </span>
      ) : null}
    </div>
  );
}
