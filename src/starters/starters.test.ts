import { describe, expect, it } from 'vitest'
import { PROJECT_FORMAT, PROJECT_VERSION, parseProjectText } from '../shared/project'
import { definitionOf } from '../renderer/parts/definitions'
import { STARTERS, STARTER_CATEGORIES, starterById, startersByCategory } from './catalog'

describe('starter catalog', () => {
  it('has unique ids and files', () => {
    expect(new Set(STARTERS.map((starter) => starter.id)).size).toBe(STARTERS.length)
    expect(new Set(STARTERS.map((starter) => starter.fileName)).size).toBe(STARTERS.length)
  })

  it('covers every advertised category', () => {
    for (const category of STARTER_CATEGORIES) {
      expect(startersByCategory(category.id).length).toBeGreaterThan(0)
    }
  })

  it('looks starters up by id', () => {
    expect(starterById('uno-blink')?.title).toBe('Blink an LED')
    expect(starterById('missing')).toBeUndefined()
  })

  it.each(STARTERS.map((starter) => [starter.title, starter] as const))(
    'parses %s as a valid v2 project',
    (_title, starter) => {
      const project = parseProjectText(starter.projectText)
      expect(project.format).toBe(PROJECT_FORMAT)
      expect(project.version).toBe(PROJECT_VERSION)
      if (project.version !== PROJECT_VERSION) throw new Error('expected v2 starter')
      expect(project.metadata.app_version).toBe('0.5.0-beta.2')
      expect(project.viewport.scale).toBeGreaterThan(0)
      expect(project.sketch.trim().length).toBeGreaterThan(0)
      expect(project.circuit.parts.length).toBeGreaterThan(0)

      const partIds = new Set(project.circuit.parts.map((part) => part.id))
      expect(partIds.size).toBe(project.circuit.parts.length)

      for (const part of project.circuit.parts) {
        const definition = definitionOf(part.type)
        expect(definition.type).toBe(part.type)
      }

      for (const wire of project.circuit.wires) {
        expect(partIds.has(wire.from.partId)).toBe(true)
        expect(partIds.has(wire.to.partId)).toBe(true)
        const fromPart = project.circuit.parts.find((part) => part.id === wire.from.partId)
        const toPart = project.circuit.parts.find((part) => part.id === wire.to.partId)
        if (fromPart === undefined || toPart === undefined) throw new Error('missing wire part')
        expect(definitionOf(fromPart.type).pins.some((pin) => pin.id === wire.from.pinId)).toBe(
          true
        )
        expect(definitionOf(toPart.type).pins.some((pin) => pin.id === wire.to.pinId)).toBe(true)
      }
    }
  )
})
