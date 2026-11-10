export type ServoOptions = {
  minUs?: number;
  maxUs?: number;
  minAngle?: number;
  maxAngle?: number;
};

/** Maps a servo control pulse width (µs) to an angle, clamped to the travel range. */
export function servoAngle(pulseMicros: number, options: ServoOptions = {}): number {
  const minUs = options.minUs ?? 1000;
  const maxUs = options.maxUs ?? 2000;
  const minAngle = options.minAngle ?? 0;
  const maxAngle = options.maxAngle ?? 180;
  const ratio = (pulseMicros - minUs) / (maxUs - minUs);
  const clamped = Math.max(0, Math.min(1, ratio));
  return minAngle + clamped * (maxAngle - minAngle);
}

/** Inverse: the pulse width for a target angle. */
export function servoPulse(angle: number, options: ServoOptions = {}): number {
  const minUs = options.minUs ?? 1000;
  const maxUs = options.maxUs ?? 2000;
  const minAngle = options.minAngle ?? 0;
  const maxAngle = options.maxAngle ?? 180;
  const ratio = (angle - minAngle) / (maxAngle - minAngle);
  return minUs + Math.max(0, Math.min(1, ratio)) * (maxUs - minUs);
}
