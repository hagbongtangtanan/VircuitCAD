export type SimErrorCode =
  | 'SHORT_CIRCUIT'
  | 'NO_GROUND'
  | 'FLOATING'
  | 'NO_CONVERGENCE'
  | 'SOURCE_LOOP';

export type SimErrorRef = { kind: 'node' | 'part' | 'device'; id: string };

export class SimError extends Error {
  readonly code: SimErrorCode;
  readonly refs: readonly SimErrorRef[];

  constructor(code: SimErrorCode, message: string, refs: readonly SimErrorRef[] = []) {
    super(message);
    this.name = 'SimError';
    this.code = code;
    this.refs = refs;
  }
}
