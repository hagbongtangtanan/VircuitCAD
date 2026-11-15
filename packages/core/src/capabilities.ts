export type Capability = 'simulation' | 'codeEditor' | 'codeActions' | 'compile' | 'serialSend';

export type Capabilities = Record<Capability, boolean>;

/** Which capabilities the build supports. Controls are disabled (with a reason) when false. */
export function defaultCapabilities(): Capabilities {
  return {
    simulation: true,
    codeEditor: true,
    codeActions: true,
    compile: true,
    serialSend: false,
  };
}

const REASONS: Record<Capability, string> = {
  simulation: 'Simulation is not available in this build',
  codeEditor: 'The code editor is not available in this build',
  codeActions: 'Code actions are not available in this build',
  compile: 'Compiling is not available in this build',
  serialSend: 'Sending serial data is not available in this build',
};

export function unavailableReason(capability: Capability): string {
  return REASONS[capability];
}
