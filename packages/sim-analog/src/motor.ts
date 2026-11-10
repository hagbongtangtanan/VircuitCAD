export type MotorParams = {
  resistance: number;
  backEmf: number;
  torqueConstant?: number;
  inertia: number;
  friction: number;
};

export type MotorState = { omega: number; current: number };

/** L293D H-bridge direction: enable + opposing inputs, else coast/brake (0). */
export function hBridgeOutput(in1: boolean, in2: boolean, enable: boolean): -1 | 0 | 1 {
  if (!enable || in1 === in2) return 0;
  return in1 ? 1 : -1;
}

/**
 * Integrates a brushed DC motor (electrical steady state + mechanical inertia).
 * `voltage` includes the applied armature voltage; returns the new speed/current.
 */
export function stepMotor(
  state: MotorState,
  voltage: number,
  params: MotorParams,
  dt: number,
): MotorState {
  const torqueConstant = params.torqueConstant ?? params.backEmf;
  const current = (voltage - params.backEmf * state.omega) / params.resistance;
  const torque = torqueConstant * current;
  const omega = state.omega + ((torque - params.friction * state.omega) / params.inertia) * dt;
  return { omega, current };
}
