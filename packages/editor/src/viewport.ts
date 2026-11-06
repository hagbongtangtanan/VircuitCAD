export type Vec2 = { x: number; y: number };
export type Viewport = { scale: number; x: number; y: number };

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function screenToWorld(viewport: Viewport, screenX: number, screenY: number): Vec2 {
  return {
    x: (screenX - viewport.x) / viewport.scale,
    y: (screenY - viewport.y) / viewport.scale,
  };
}

export function worldToScreen(viewport: Viewport, worldX: number, worldY: number): Vec2 {
  return { x: worldX * viewport.scale + viewport.x, y: worldY * viewport.scale + viewport.y };
}

export function zoomAt(
  viewport: Viewport,
  factor: number,
  screenX: number,
  screenY: number,
): Viewport {
  const scale = clampScale(viewport.scale * factor);
  const world = screenToWorld(viewport, screenX, screenY);
  return { scale, x: screenX - world.x * scale, y: screenY - world.y * scale };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}
