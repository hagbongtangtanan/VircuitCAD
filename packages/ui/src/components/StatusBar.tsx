import { useEffect, useRef } from 'react';

export type StatusBarViewport = {
  getViewport(): { scale: number };
  onViewportChange(listener: () => void): () => void;
};

export type StatusBarProps = {
  partCount: number;
  wireCount: number;
  zoom?: number;
  viewport?: StatusBarViewport | undefined;
  hint?: string;
  simState?: string;
  simTime?: number;
  saved?: boolean;
  version?: string;
};

function Separator() {
  return <span className="status-sep" aria-hidden="true" />;
}

export function StatusBar({
  partCount,
  wireCount,
  zoom,
  viewport,
  hint,
  simState,
  simTime,
  saved = true,
  version,
}: StatusBarProps) {
  const zoomRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!viewport) return undefined;
    const update = (): void => {
      if (zoomRef.current) {
        zoomRef.current.textContent = `${Math.round(viewport.getViewport().scale * 100)}%`;
      }
    };
    update();
    return viewport.onViewportChange(update);
  }, [viewport]);

  const initialZoom = zoom !== undefined ? `${Math.round(zoom * 100)}%` : '100%';

  return (
    <div className="status-bar" role="status">
      <span className="status-segment" data-testid="status-parts">
        {partCount} parts
      </span>
      <Separator />
      <span className="status-segment" data-testid="status-wires">
        {wireCount} wires
      </span>
      <Separator />
      <span className="status-segment" data-testid="status-zoom" ref={zoomRef}>
        {initialZoom}
      </span>
      <Separator />
      <span className="status-segment" data-testid="status-sim">
        {simState && simState !== 'idle' ? simState : 'Stopped'}
        {simTime !== undefined && simTime > 0 ? ` ${(simTime * 1000).toFixed(0)} ms` : ' 0 ms'}
      </span>
      {hint ? (
        <>
          <Separator />
          <span className="status-segment" data-testid="status-hint">
            {hint}
          </span>
        </>
      ) : null}
      <span className="status-spacer" />
      <span
        className={saved ? 'status-segment status-saved' : 'status-segment status-saved is-dirty'}
        data-testid="status-saved"
      >
        <span aria-hidden="true">{saved ? '●' : '○'}</span> {saved ? 'Saved' : 'Unsaved changes'}
      </span>
      {version ? (
        <span className="status-segment version" data-testid="version">
          v{version}
        </span>
      ) : null}
    </div>
  );
}
