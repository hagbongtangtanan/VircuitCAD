import type { CircuitDocument, PinRef, PartType } from '../../shared/circuit'
import { pinKey } from '../../shared/circuit'
import { definitionOf, type PartDefinition } from '../parts/definitions'

/**
 * Every pin in the document is a node. Wires join two nodes, and each part's
 * `internalNets` join the nodes it connects internally (breadboard strips and
 * rails, and so on). Union-find then collapses all of that into nets.
 *
 * This is a *connectivity* model, not SPICE: it answers "are these two pins the
 * same net", which is what the simulator needs to resolve LED polarity, switch
 * state and ADC inputs.
 */
export interface Netlist {
  readonly netCount: number
  /** Pin key (`partId:pinId`) to net id. */
  readonly netIdByPin: ReadonlyMap<string, number>
  /** Net id to the pin keys on it. */
  readonly pinsByNet: ReadonlyMap<number, readonly string[]>
  netIdOf(pin: PinRef): number | undefined
  areConnected(a: PinRef, b: PinRef): boolean
}

export type DefinitionLookup = (type: PartType) => PartDefinition

function find(parent: Map<string, string>, key: string): string {
  let root = key
  let cursor = parent.get(root)
  while (cursor !== undefined && cursor !== root) {
    root = cursor
    cursor = parent.get(root)
  }

  // Path compression, so repeated lookups stay near-constant time.
  let walk = key
  let next = parent.get(walk)
  while (next !== undefined && next !== walk) {
    parent.set(walk, root)
    walk = next
    next = parent.get(walk)
  }

  return root
}

function union(parent: Map<string, string>, a: string, b: string): void {
  const rootA = find(parent, a)
  const rootB = find(parent, b)
  if (rootA !== rootB) {
    parent.set(rootB, rootA)
  }
}

export function buildNetlist(
  document: CircuitDocument,
  lookup: DefinitionLookup = definitionOf
): Netlist {
  const parent = new Map<string, string>()

  for (const part of document.parts) {
    for (const partPin of lookup(part.type).pins) {
      const key = pinKey({ partId: part.id, pinId: partPin.id })
      parent.set(key, key)
    }
  }

  for (const part of document.parts) {
    const internalNets = lookup(part.type).internalNets
    if (internalNets === undefined) continue

    for (const group of internalNets) {
      const [first, ...rest] = group
      if (first === undefined) continue
      const firstKey = pinKey({ partId: part.id, pinId: first })
      if (!parent.has(firstKey)) continue
      for (const other of rest) {
        const otherKey = pinKey({ partId: part.id, pinId: other })
        if (parent.has(otherKey)) union(parent, firstKey, otherKey)
      }
    }
  }

  for (const wire of document.wires) {
    const fromKey = pinKey(wire.from)
    const toKey = pinKey(wire.to)
    if (parent.has(fromKey) && parent.has(toKey)) {
      union(parent, fromKey, toKey)
    }
  }

  const netIdByRoot = new Map<string, number>()
  const netIdByPin = new Map<string, number>()
  const pinsByNet = new Map<number, string[]>()

  for (const key of parent.keys()) {
    const root = find(parent, key)
    let netId = netIdByRoot.get(root)
    if (netId === undefined) {
      netId = netIdByRoot.size
      netIdByRoot.set(root, netId)
      pinsByNet.set(netId, [])
    }
    netIdByPin.set(key, netId)
    pinsByNet.get(netId)?.push(key)
  }

  return {
    netCount: netIdByRoot.size,
    netIdByPin,
    pinsByNet,
    netIdOf(pin: PinRef): number | undefined {
      return netIdByPin.get(pinKey(pin))
    },
    areConnected(a: PinRef, b: PinRef): boolean {
      const netA = netIdByPin.get(pinKey(a))
      const netB = netIdByPin.get(pinKey(b))
      return netA !== undefined && netA === netB
    },
  }
}
