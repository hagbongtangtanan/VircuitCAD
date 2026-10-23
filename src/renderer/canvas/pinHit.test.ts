import { describe, expect, it } from 'vitest'
import { partSchema, type PartInstance } from '../../shared/circuit'
import { findPinNear, nearestWirePin } from './pinHit'

function part(instance: PartInstance): PartInstance {
  return partSchema.parse(instance)
}

const uno = part({
  id: 'uno',
  type: 'arduino-uno',
  position: { x: 0, y: 0 },
  rotation: 0,
  props: {},
})

describe('findPinNear', () => {
  it('returns the closest terminal within the radius', () => {
    const hit = findPinNear([uno], { x: 22, y: 4 }, 12)
    expect(hit?.ref).toEqual({ partId: 'uno', pinId: 'D13' })
  })

  it('ignores pins outside the radius', () => {
    expect(findPinNear([uno], { x: 80, y: 80 }, 12)).toBeNull()
  })

  it('accounts for part rotation', () => {
    const led = part({
      id: 'led',
      type: 'led',
      position: { x: 100, y: 100 },
      rotation: 90,
      props: { color: 'red' },
    })
    const hit = findPinNear([led], { x: 100, y: 111 }, 4)
    expect(hit?.ref).toEqual({ partId: 'led', pinId: 'anode' })
    expect(hit?.point).toEqual({ x: 100, y: 110 })
  })

  it('treats breadboard sockets as ordinary targets', () => {
    const breadboard = part({
      id: 'bb',
      type: 'breadboard',
      position: { x: 0, y: 0 },
      rotation: 0,
      props: {},
    })
    const hit = findPinNear([breadboard], { x: 31, y: 61 }, 6)
    expect(hit?.ref).toEqual({ partId: 'bb', pinId: 'a1' })
  })
})

describe('nearestWirePin', () => {
  const wire = {
    id: 'w1',
    from: { partId: 'uno', pinId: 'D13' },
    to: { partId: 'uno', pinId: 'GND' },
    color: '#4f9cf9',
    waypoints: [],
  }

  it('picks the endpoint closest to the pointer', () => {
    expect(nearestWirePin(wire, [uno], { x: 25, y: 5 })).toEqual({
      partId: 'uno',
      pinId: 'D13',
    })
    expect(nearestWirePin(wire, [uno], { x: 90, y: 205 })).toEqual({
      partId: 'uno',
      pinId: 'GND',
    })
  })
})

describe('flipped pins', () => {
  it('mirrors pin positions across the vertical axis', () => {
    const led = part({
      id: 'led',
      type: 'led',
      position: { x: 100, y: 100 },
      rotation: 0,
      flipX: true,
      props: { color: 'red' },
    })

    expect(findPinNear([led], { x: 130, y: 140 }, 4)?.ref).toEqual({
      partId: 'led',
      pinId: 'anode',
    })
    expect(findPinNear([led], { x: 110, y: 140 }, 4)?.ref).toEqual({
      partId: 'led',
      pinId: 'cathode',
    })
  })

  it('mirrors before applying rotation', () => {
    const led = part({
      id: 'led',
      type: 'led',
      position: { x: 100, y: 100 },
      rotation: 90,
      flipX: true,
      props: { color: 'red' },
    })

    expect(findPinNear([led], { x: 100, y: 130 }, 4)?.ref).toEqual({
      partId: 'led',
      pinId: 'anode',
    })
    expect(findPinNear([led], { x: 100, y: 110 }, 4)?.ref).toEqual({
      partId: 'led',
      pinId: 'cathode',
    })
  })

  it('mirrors pin positions across the horizontal axis', () => {
    const led = part({
      id: 'led',
      type: 'led',
      position: { x: 100, y: 100 },
      rotation: 0,
      flipY: true,
      props: { color: 'red' },
    })

    expect(findPinNear([led], { x: 110, y: 100 }, 4)?.ref).toEqual({
      partId: 'led',
      pinId: 'anode',
    })
    expect(findPinNear([led], { x: 130, y: 100 }, 4)?.ref).toEqual({
      partId: 'led',
      pinId: 'cathode',
    })
  })
})
