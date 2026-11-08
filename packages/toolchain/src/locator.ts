import { existsSync } from 'node:fs';
import path from 'node:path';

export type ToolchainLayout = {
  root: string;
  arduinoCli: string;
  sketch: string;
  libraries: string;
  cores: string;
};

export type LocatorOptions = {
  devRoots?: string[];
  packagedRoot?: string;
  platform?: NodeJS.Platform;
};

function cliName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
}

export function locateToolchain(options: LocatorOptions = {}): ToolchainLayout | undefined {
  const platform = options.platform ?? process.platform;
  const candidates = [
    ...(options.packagedRoot ? [options.packagedRoot] : []),
    ...(options.devRoots ?? []),
  ];

  for (const root of candidates) {
    const arduinoCli = path.join(root, cliName(platform));
    if (existsSync(arduinoCli)) {
      return {
        root,
        arduinoCli,
        sketch: path.join(root, 'sketch'),
        libraries: path.join(root, 'libraries'),
        cores: path.join(root, 'cores'),
      };
    }
  }
  return undefined;
}

/** Environment that isolates arduino-cli from any user config and disables network access. */
export function isolatedEnv(layout: ToolchainLayout): Record<string, string> {
  return {
    ARDUINO_DIRECTORIES_DATA: path.join(layout.root, 'data'),
    ARDUINO_DIRECTORIES_DOWNLOADS: path.join(layout.root, 'staging'),
    ARDUINO_DIRECTORIES_USER: path.join(layout.root, 'user'),
    ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false',
    ARDUINO_BUILTIN_LIBRARIES_FIXUP: 'false',
  };
}
