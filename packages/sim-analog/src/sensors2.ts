/** TMP36 output voltage (10 mV/°C, 500 mV offset at 0 °C). */
export function tmp36Voltage(celsius: number): number {
  return 0.5 + 0.01 * celsius;
}

export function tmp36Temperature(voltage: number): number {
  return (voltage - 0.5) / 0.01;
}

const SPEED_OF_SOUND_CM_PER_US = 0.0343; // 343 m/s

/** HC-SR04 distance (cm) from the round-trip echo pulse width (µs). */
export function hcSr04Distance(echoMicros: number): number {
  return (echoMicros * SPEED_OF_SOUND_CM_PER_US) / 2;
}

export function hcSr04EchoMicros(distanceCm: number): number {
  return (distanceCm * 2) / SPEED_OF_SOUND_CM_PER_US;
}
