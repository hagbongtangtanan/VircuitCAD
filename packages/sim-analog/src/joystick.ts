export type JoystickCalibration = {
  center?: number;
  min?: number;
  max?: number;
  deadzone?: number;
};

/** Normalises an ADC axis reading to [-1, 1] with an optional centre dead-zone. */
export function joystickAxis(raw: number, calibration: JoystickCalibration = {}): number {
  const center = calibration.center ?? 512;
  const min = calibration.min ?? 0;
  const max = calibration.max ?? 1023;
  const deadzone = calibration.deadzone ?? 0.05;

  const span = raw < center ? center - min : max - center;
  const normalized = span === 0 ? 0 : (raw - center) / span;
  if (Math.abs(normalized) < deadzone) return 0;
  return Math.max(-1, Math.min(1, normalized));
}
