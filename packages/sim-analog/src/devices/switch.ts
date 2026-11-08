import type { Device } from '../device';

export type SwitchDevice = Device & {
  readonly closed: boolean;
  setClosed(value: boolean): void;
};

export type SwitchOptions = {
  closed?: boolean;
  onResistance?: number;
};

export function createSwitch(
  name: string,
  nodeA: number,
  nodeB: number,
  options: SwitchOptions = {},
): SwitchDevice {
  const onResistance = options.onResistance ?? 1e-3;
  let closed = options.closed ?? false;

  return {
    name,
    kind: 'switch',
    nodes: [nodeA, nodeB],
    get closed() {
      return closed;
    },
    setClosed(value: boolean) {
      closed = value;
    },
    stamp: (ctx) => {
      if (closed) ctx.addConductance(nodeA, nodeB, 1 / onResistance);
    },
  };
}
