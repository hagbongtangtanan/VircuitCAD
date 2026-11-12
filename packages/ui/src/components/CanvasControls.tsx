import { useEffect, useRef, useState } from 'react';

import { ICONS } from '../icons';

/** Structural view of the editor's viewport API (no dependency on @vircuitcad/editor). */
export type CanvasViewport = {
  zoomByCentre(factor: number): void;
  resetZoom(): void;
  fitToContent(): void;
  setGridVisible(visible: boolean): void;
  isGridVisible(): boolean;
  getViewport(): { scale: number };
  onViewportChange(listener: () => void): () => void;
};

export type CanvasControlsProps = {
  viewport?: CanvasViewport | undefined;
};

export function CanvasControls({ viewport }: CanvasControlsProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [gridVisible, setGridVisible] = useState(() => viewport?.isGridVisible() ?? true);

  useEffect(() => {
    if (!viewport) return undefined;
    const update = (): void => {
      if (labelRef.current) {
        labelRef.current.textContent = `${Math.round(viewport.getViewport().scale * 100)}%`;
      }
    };
    update();
    return viewport.onViewportChange(update);
  }, [viewport]);

  return (
    <div className="canvas-controls" data-testid="canvas-controls">
      <button
        type="button"
        className="canvas-control"
        aria-label="Zoom out"
        title="Zoom out (−)"
        onClick={() => viewport?.zoomByCentre(1 / 1.2)}
      >
        <ICONS.zoomOut size={16} />
      </button>
      <button
        type="button"
        className="canvas-control canvas-control--label"
        aria-label="Reset zoom"
        title="Reset zoom to 100%"
        onClick={() => viewport?.resetZoom()}
      >
        <span ref={labelRef} data-testid="canvas-zoom">
          100%
        </span>
      </button>
      <button
        type="button"
        className="canvas-control"
        aria-label="Zoom in"
        title="Zoom in (+)"
        onClick={() => viewport?.zoomByCentre(1.2)}
      >
        <ICONS.zoomIn size={16} />
      </button>
      <button
        type="button"
        className="canvas-control"
        aria-label="Fit to content"
        title="Fit to content"
        onClick={() => viewport?.fitToContent()}
      >
        <ICONS.zoomFit size={16} />
      </button>
      <button
        type="button"
        className="canvas-control"
        aria-label="Toggle grid"
        aria-pressed={gridVisible}
        title="Toggle grid"
        onClick={() => {
          const next = !gridVisible;
          setGridVisible(next);
          viewport?.setGridVisible(next);
        }}
      >
        <ICONS.grid size={16} />
      </button>
    </div>
  );
}
