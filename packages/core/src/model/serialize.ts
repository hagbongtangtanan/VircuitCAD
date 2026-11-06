import { CircuitSchema, SCHEMA_VERSION, type Circuit } from './circuit';

export type Migration = {
  from: number;
  to: number;
  migrate: (input: unknown) => unknown;
};

export const circuitMigrations: Migration[] = [];

export function getSchemaVersion(raw: unknown): number {
  if (typeof raw === 'object' && raw !== null && 'schemaVersion' in raw) {
    const value = (raw as { schemaVersion: unknown }).schemaVersion;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
  }
  throw new Error('document is missing a numeric schemaVersion');
}

export function runMigrations(
  raw: unknown,
  migrations: readonly Migration[],
  target: number,
): unknown {
  let current = raw;
  let version = getSchemaVersion(current);
  if (version > target) {
    throw new Error(`document schemaVersion ${version} is newer than supported ${target}`);
  }

  const visited = new Set<number>();
  while (version < target) {
    if (visited.has(version)) throw new Error(`migration cycle at schemaVersion ${version}`);
    visited.add(version);

    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration) throw new Error(`no migration from schemaVersion ${version}`);

    current = migration.migrate(current);
    const next = getSchemaVersion(current);
    if (next !== migration.to) {
      throw new Error(`migration from ${version} produced version ${next}, expected ${migration.to}`);
    }
    version = next;
  }

  return current;
}

export function serializeCircuit(circuit: Circuit): string {
  return `${JSON.stringify(CircuitSchema.parse(circuit), null, 2)}\n`;
}

export function deserializeCircuit(
  text: string,
  options: { migrations?: readonly Migration[]; targetVersion?: number } = {},
): Circuit {
  const migrations = options.migrations ?? circuitMigrations;
  const target = options.targetVersion ?? SCHEMA_VERSION;
  const raw: unknown = JSON.parse(text);
  return CircuitSchema.parse(runMigrations(raw, migrations, target));
}
