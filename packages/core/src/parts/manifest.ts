import { z } from 'zod';

import { ParamValueSchema, Vec2Schema } from '../model/circuit';

export const PinRoleSchema = z.enum([
  'passive',
  'power',
  'ground',
  'input',
  'output',
  'bidirectional',
]);
export type PinRole = z.infer<typeof PinRoleSchema>;

export const PinSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: Vec2Schema,
  role: PinRoleSchema,
});
export type Pin = z.infer<typeof PinSchema>;

export const ParamSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  unit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  default: ParamValueSchema,
  /** When present the value is an enum and should be edited with a select. */
  options: z.array(z.string().min(1)).min(1).optional(),
});
export type ParamSpec = z.infer<typeof ParamSpecSchema>;

export const PartCategorySchema = z.enum([
  'passive',
  'opto',
  'power',
  'digital',
  'mcu',
  'instrument',
]);
export type PartCategory = z.infer<typeof PartCategorySchema>;

export const PartManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: PartCategorySchema,
    pins: z.array(PinSchema).min(1),
    params: z.array(ParamSpecSchema),
    simModel: z.string().min(1),
    svg: z.string().min(1),
    schematicSymbol: z.string().min(1).optional(),
    status: z.enum(['ready', 'planned']).default('ready'),
  })
  .superRefine((manifest, ctx) => {
    const pinIds = new Set<string>();
    for (const pin of manifest.pins) {
      if (pinIds.has(pin.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate pin id "${pin.id}"`, path: ['pins'] });
      }
      pinIds.add(pin.id);
    }

    const paramIds = new Set<string>();
    for (const param of manifest.params) {
      if (paramIds.has(param.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate param id "${param.id}"`,
          path: ['params'],
        });
      }
      paramIds.add(param.id);

      if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
        ctx.addIssue({
          code: 'custom',
          message: `param "${param.id}": min is greater than max`,
          path: ['params'],
        });
      }
      if (typeof param.default === 'number') {
        if (param.min !== undefined && param.default < param.min) {
          ctx.addIssue({
            code: 'custom',
            message: `param "${param.id}": default is below min`,
            path: ['params'],
          });
        }
        if (param.max !== undefined && param.default > param.max) {
          ctx.addIssue({
            code: 'custom',
            message: `param "${param.id}": default is above max`,
            path: ['params'],
          });
        }
      }
    }
  });
export type PartManifest = z.infer<typeof PartManifestSchema>;

/** A part is placeable only once its model and art are ready. */
export function isPlaceable(manifest: PartManifest): boolean {
  return manifest.status === 'ready';
}
