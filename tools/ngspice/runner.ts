import { execFileSync } from 'node:child_process';

export function hasNgspice(): boolean {
  try {
    execFileSync('ngspice', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Runs a SPICE netlist through native ngspice; returns stdout, or undefined if ngspice is absent. */
export function runNgspice(netlist: string): string | undefined {
  if (!hasNgspice()) return undefined;
  try {
    return execFileSync('ngspice', ['-b', '-o', '/dev/stdout'], {
      input: netlist,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}
