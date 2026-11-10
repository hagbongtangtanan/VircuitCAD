export type Waveform = 'sine' | 'square' | 'triangle';

export type FunctionGenOptions = {
  waveform: Waveform;
  frequency: number;
  amplitude: number;
  offset?: number;
};

/** Samples a function-generator waveform at time `t` (seconds). */
export function sampleWaveform(options: FunctionGenOptions, t: number): number {
  const offset = options.offset ?? 0;
  const amplitude = options.amplitude;
  let phase = (t * options.frequency) % 1;
  if (phase < 0) phase += 1;

  switch (options.waveform) {
    case 'sine':
      return offset + amplitude * Math.sin(2 * Math.PI * phase);
    case 'square':
      return offset + (phase < 0.5 ? amplitude : -amplitude);
    case 'triangle':
      return offset + amplitude * (phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase);
  }
}
