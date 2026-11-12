/**
 * Texture cache key: part id, variant and renderer resolution (docs/DESIGN.md 3.5).
 * Rotation is handled by the sprite transform, not the texture, so it is not part of the key.
 */
export type ArtVariant = 'default' | 'selected' | 'preview-valid' | 'preview-invalid';

export function partTextureKey(partId: string, variant: string, resolution: number): string {
  return `part:${partId}:${variant}:${resolution}`;
}
