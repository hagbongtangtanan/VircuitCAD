import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { ICONS } from '../icons';

export type AppShellProps = {
  toolbar: ReactNode;
  left: ReactNode;
  right: ReactNode;
  status: ReactNode;
  children: ReactNode;
};

export const PANEL_MIN = 200;
export const PANEL_MAX = 420;
export const PANEL_STEP = 16;

const STORAGE_KEY = 'vircuitcad.shell';

export type ShellState = {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
};

const DEFAULTS: ShellState = {
  leftWidth: 260,
  rightWidth: 300,
  leftCollapsed: false,
  rightCollapsed: false,
};

export function clampPanel(width: number): number {
  if (!Number.isFinite(width)) return DEFAULTS.leftWidth;
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(width)));
}

function loadState(): ShellState {
  try {
    if (typeof localStorage === 'undefined') return DEFAULTS;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ShellState>;
    return {
      leftWidth: clampPanel(parsed.leftWidth ?? DEFAULTS.leftWidth),
      rightWidth: clampPanel(parsed.rightWidth ?? DEFAULTS.rightWidth),
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
    };
  } catch {
    return DEFAULTS;
  }
}

export function AppShell({ toolbar, left, right, status, children }: AppShellProps) {
  const [state, setState] = useState<ShellState>(loadState);
  const [dragging, setDragging] = useState<'left' | 'right' | undefined>(undefined);
  const drag = useRef<{ side: 'left' | 'right'; startX: number; startWidth: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      /* storage unavailable — session-only */
    }
  }, [state]);

  useEffect(() => {
    if (!dragging) return undefined;
    const side = dragging;
    const onMove = (event: globalThis.PointerEvent): void => {
      const info = drag.current;
      if (!info) return;
      const delta = event.clientX - info.startX;
      const raw = side === 'left' ? info.startWidth + delta : info.startWidth - delta;
      const width = clampPanel(raw);
      setState((previous) =>
        side === 'left' ? { ...previous, leftWidth: width } : { ...previous, rightWidth: width },
      );
    };
    const onUp = (): void => {
      drag.current = undefined;
      setDragging(undefined);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  const onPointerDown = (side: 'left' | 'right') => (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    drag.current = {
      side,
      startX: event.clientX,
      startWidth: side === 'left' ? state.leftWidth : state.rightWidth,
    };
    setDragging(side);
  };

  const onKeyDown = (side: 'left' | 'right') => (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const delta = side === 'left' ? direction * PANEL_STEP : -direction * PANEL_STEP;
    setState((previous) =>
      side === 'left'
        ? { ...previous, leftWidth: clampPanel(previous.leftWidth + delta) }
        : { ...previous, rightWidth: clampPanel(previous.rightWidth + delta) },
    );
  };

  const separator = (side: 'left' | 'right', width: number) => (
    <div
      className="panel-separator"
      data-testid={`separator-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize parts panel' : 'Resize inspector panel'}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown(side)}
      onKeyDown={onKeyDown(side)}
    />
  );

  return (
    <div className="app-shell" data-testid="app-shell" data-dragging={dragging}>
      <div className="app-toolbar" data-testid="app-toolbar">
        {toolbar}
      </div>
      <div className="app-body" data-testid="app-body">
        <div className="app-col app-col--left">
          {state.leftCollapsed ? (
            <div className="panel-rail panel-rail--left" data-testid="left-rail">
              <button
                type="button"
                className="panel-toggle"
                aria-label="Show parts panel"
                title="Show parts panel"
                onClick={() => setState((previous) => ({ ...previous, leftCollapsed: false }))}
              >
                <ICONS.panelLeft />
              </button>
            </div>
          ) : (
            <>
              <aside
                className="app-panel app-panel--left"
                data-testid="left-panel"
                style={{ width: state.leftWidth }}
              >
                <div className="panel-header">
                  <span>Parts</span>
                  <button
                    type="button"
                    className="panel-toggle"
                    aria-label="Hide parts panel"
                    title="Hide parts panel"
                    onClick={() => setState((previous) => ({ ...previous, leftCollapsed: true }))}
                  >
                    <ICONS.panelLeft />
                  </button>
                </div>
                <div className="panel-content">{left}</div>
              </aside>
              {separator('left', state.leftWidth)}
            </>
          )}
        </div>
        <section className="app-main" data-testid="app-main">
          {children}
        </section>
        <div className="app-col app-col--right">
          {state.rightCollapsed ? (
            <div className="panel-rail panel-rail--right" data-testid="right-rail">
              <button
                type="button"
                className="panel-toggle"
                aria-label="Show inspector panel"
                title="Show inspector panel"
                onClick={() => setState((previous) => ({ ...previous, rightCollapsed: false }))}
              >
                <ICONS.panelRight />
              </button>
            </div>
          ) : (
            <>
              {separator('right', state.rightWidth)}
              <aside
                className="app-panel app-panel--right"
                data-testid="right-panel"
                style={{ width: state.rightWidth }}
              >
                <div className="panel-header">
                  <span>Inspector</span>
                  <button
                    type="button"
                    className="panel-toggle"
                    aria-label="Hide inspector panel"
                    title="Hide inspector panel"
                    onClick={() => setState((previous) => ({ ...previous, rightCollapsed: true }))}
                  >
                    <ICONS.panelRight />
                  </button>
                </div>
                <div className="panel-content">{right}</div>
              </aside>
            </>
          )}
        </div>
      </div>
      <div className="app-status" data-testid="app-status">
        {status}
      </div>
    </div>
  );
}
