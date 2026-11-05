import { describe, expect, it } from 'vitest';

import { AppInfoSchema, CompileResultSchema, PlatformError, ToolchainInfoSchema } from './types';
import type { PlatformAdapter } from './types';

function bytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) out[index] = value.charCodeAt(index);
  return out;
}

function text(value: Uint8Array): string {
  let result = '';
  for (const byte of value) result += String.fromCharCode(byte);
  return result;
}

export function definePlatformAdapterContract(
  name: string,
  create: () => PlatformAdapter | Promise<PlatformAdapter>,
): void {
  describe(`PlatformAdapter contract: ${name}`, () => {
    it('reports schema-valid app info with absolute paths', async () => {
      const adapter = await create();
      const info = await adapter.app.info();
      expect(AppInfoSchema.safeParse(info).success).toBe(true);
      expect(info.paths.appData.startsWith('/')).toBe(true);
    });

    it('round-trips files inside allowed roots', async () => {
      const adapter = await create();
      const { paths } = await adapter.app.info();
      const file = `${paths.appData}/circuits/demo.vcad`;

      await adapter.fs.writeFile(file, bytes('{"schemaVersion":1}'));
      expect(await adapter.fs.exists(file)).toBe(true);
      expect(text(await adapter.fs.readFile(file))).toBe('{"schemaVersion":1}');
      expect(await adapter.fs.readdir(`${paths.appData}/circuits`)).toContain('demo.vcad');

      await adapter.fs.remove(file);
      expect(await adapter.fs.exists(file)).toBe(false);
    });

    it('rejects paths outside the allowed roots', async () => {
      const adapter = await create();
      await expect(adapter.fs.readFile('/etc/passwd')).rejects.toBeInstanceOf(PlatformError);
    });

    it('raises a typed error for missing files', async () => {
      const adapter = await create();
      const { paths } = await adapter.app.info();
      await expect(adapter.fs.readFile(`${paths.appData}/missing.vcad`)).rejects.toBeInstanceOf(
        PlatformError,
      );
    });

    it('resolves dialogs to a path or null', async () => {
      const adapter = await create();
      await expect(adapter.dialogs.openFile({ title: 'Open' })).resolves.toSatisfy(
        (value: unknown) => value === null || typeof value === 'string',
      );
      await expect(adapter.dialogs.saveFile()).resolves.toSatisfy(
        (value: unknown) => value === null || typeof value === 'string',
      );
    });

    it('produces a schema-valid compile result', async () => {
      const adapter = await create();
      const result = await adapter.compile.compile({
        source: 'void setup() {}',
        fqbn: 'arduino:avr:uno',
      });
      expect(CompileResultSchema.safeParse(result).success).toBe(true);
    });

    it('reports schema-valid toolchain info', async () => {
      const adapter = await create();
      const info = await adapter.toolchain.info();
      expect(ToolchainInfoSchema.safeParse(info).success).toBe(true);
    });
  });
}
