export type StatusBarProps = {
  partCount: number;
  wireCount: number;
  zoom: number;
  hint?: string;
};

export function StatusBar({ partCount, wireCount, zoom, hint }: StatusBarProps) {
  return (
    <div className="status-bar" role="status">
      <span data-testid="status-parts">{partCount} parts</span>
      <span data-testid="status-wires">{wireCount} wires</span>
      <span data-testid="status-zoom">{Math.round(zoom * 100)}%</span>
      {hint ? <span data-testid="status-hint">{hint}</span> : null}
    </div>
  );
}
