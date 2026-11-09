export type RunState = 'idle' | 'compiling' | 'running' | 'error';

export type CompileOutcome = {
  ok: boolean;
  hex?: string;
  diagnostics: { severity: string; message: string }[];
};

export type RunControllerDeps = {
  compile: () => Promise<CompileOutcome>;
  onStart: (hex: string) => void;
  onStop: () => void;
};

/** Small state machine for Build → Run/Stop with request ids so stale results are dropped. */
export class RunController {
  private state: RunState = 'idle';
  private requestId = 0;
  private dirtyWhileRunning = false;

  onChange?: (state: RunState) => void;

  constructor(private readonly deps: RunControllerDeps) {}

  getState(): RunState {
    return this.state;
  }

  get isDirty(): boolean {
    return this.dirtyWhileRunning;
  }

  private setState(state: RunState): void {
    this.state = state;
    this.onChange?.(state);
  }

  async build(): Promise<void> {
    const id = (this.requestId += 1);
    this.setState('compiling');

    const result = await this.deps.compile();
    if (id !== this.requestId) return; // superseded by stop/cancel/another build

    if (result.ok && result.hex) {
      this.deps.onStart(result.hex);
      this.dirtyWhileRunning = false;
      this.setState('running');
    } else {
      this.setState('error');
    }
  }

  stop(): void {
    this.requestId += 1;
    this.deps.onStop();
    this.dirtyWhileRunning = false;
    this.setState('idle');
  }

  cancel(): void {
    this.requestId += 1;
    if (this.state === 'compiling') this.setState('idle');
  }

  /** Marks the sketch dirty; while running this should prompt the user to restart. */
  markEdited(): boolean {
    if (this.state === 'running') {
      this.dirtyWhileRunning = true;
      return true;
    }
    return false;
  }
}
