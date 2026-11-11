import { SETTINGS_FILE, deserializeSettings, defaultSettings, serializeSettings, type Settings } from './settings';
import type { PlatformAdapter } from '../platform/types';

function encode(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) out[index] = value.charCodeAt(index) & 0xff;
  return out;
}

function decode(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) result += String.fromCharCode(byte);
  return result;
}

function settingsPath(appData: string): string {
  return `${appData}/${SETTINGS_FILE}`;
}

export async function loadSettings(adapter: PlatformAdapter): Promise<Settings> {
  const { paths } = await adapter.app.info();
  const file = settingsPath(paths.appData);
  if (!(await adapter.fs.exists(file))) return defaultSettings();
  return deserializeSettings(decode(await adapter.fs.readFile(file)));
}

export async function saveSettings(adapter: PlatformAdapter, settings: Settings): Promise<void> {
  const { paths } = await adapter.app.info();
  await adapter.fs.writeFile(settingsPath(paths.appData), encode(serializeSettings(settings)));
}
