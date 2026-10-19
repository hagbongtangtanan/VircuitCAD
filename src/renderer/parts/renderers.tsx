import type { JSX } from 'react'
import { Circle, Ellipse, Group, Line, Rect, Text } from 'react-konva'
import type { PartInstance } from '../../shared/circuit'
import { BREADBOARD_COLUMNS, BREADBOARD_LAYOUT, definitionOf } from './definitions'
import { LED_COLORS, PART_BODY_FILL, PART_BODY_STROKE, PART_SELECTED_STROKE } from './partColors'
import { resistorBands } from './resistorBands'

export interface PartBodyProps {
  readonly part: PartInstance
  readonly selected: boolean
}

/**
 * Draws a part in its own top-left coordinate space. The parent `Group` applies
 * position, rotation and selection styling, so every case here is plain local
 * geometry that matches the pin offsets in `definitions.ts`.
 */
export function PartBody({ part, selected }: PartBodyProps): JSX.Element {
  const outline = selected ? PART_SELECTED_STROKE : PART_BODY_STROKE
  const outlineWidth = selected ? 2 : 1
  const size = definitionOf(part.type).size

  switch (part.type) {
    case 'led': {
      const palette = LED_COLORS[part.props.color]
      return (
        <>
          <Line points={[10, 40, 10, 26]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 40, 30, 26]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Circle
            x={20}
            y={16}
            radius={12}
            fill={palette.body}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Ellipse x={17} y={13} radiusX={4} radiusY={3} fill={palette.glow} opacity={0.85} />
          <Line points={[28, 24, 33, 28]} stroke={PART_BODY_STROKE} strokeWidth={2} />
        </>
      )
    }

    case 'resistor': {
      const bands = resistorBands(part.props.resistanceOhms)
      return (
        <>
          <Line points={[0, 10, 12, 10]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[48, 10, 60, 10]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={12}
            y={2}
            width={36}
            height={16}
            cornerRadius={5}
            fill="#d8cfae"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {bands.map((color, index) => (
            <Rect
              key={`${color}-${index}`}
              x={18 + index * 7}
              y={3}
              width={4}
              height={14}
              fill={color}
            />
          ))}
        </>
      )
    }

    case 'push-button':
      return (
        <>
          <Rect
            x={4}
            y={8}
            width={32}
            height={24}
            cornerRadius={4}
            fill={PART_BODY_FILL}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={20} y={20} radius={8} fill="#3b4252" stroke={PART_BODY_STROKE} />
        </>
      )

    case 'potentiometer':
      return (
        <>
          <Rect
            x={4}
            y={8}
            width={52}
            height={24}
            cornerRadius={4}
            fill={PART_BODY_FILL}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={30} y={20} radius={7} fill="#4a5468" />
          <Line points={[30, 27, 30, 40]} stroke={PART_BODY_STROKE} strokeWidth={2} />
        </>
      )

    case 'buzzer':
      return (
        <>
          <Circle
            x={20}
            y={16}
            radius={13}
            fill={PART_BODY_FILL}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={20} y={16} radius={4} fill="#11131a" />
          <Line points={[10, 40, 10, 27]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 40, 30, 27]} stroke={PART_BODY_STROKE} strokeWidth={2} />
        </>
      )

    case 'arduino-uno':
      return (
        <>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            cornerRadius={6}
            fill="#0f7c92"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={18} y={70} width={34} height={44} cornerRadius={3} fill="#c9ced8" />
          <Rect x={18} y={132} width={34} height={32} cornerRadius={3} fill="#11131a" />
          <Rect x={70} y={70} width={56} height={56} cornerRadius={4} fill="#1b1f29" />
          <Text x={150} y={95} text="UNO R3" fontSize={18} fill="#e6e9f0" fontStyle="bold" />
        </>
      )

    case 'breadboard': {
      const { size: boardSize, rails, halves, firstColumnX, columnPitch } = BREADBOARD_LAYOUT
      const lastColumnX = firstColumnX + (BREADBOARD_COLUMNS - 1) * columnPitch
      return (
        <>
          <Rect
            x={0}
            y={0}
            width={boardSize.width}
            height={boardSize.height}
            cornerRadius={6}
            fill="#e8e3d9"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect
            x={16}
            y={halves[0].bottom}
            width={boardSize.width - 32}
            height={halves[1].top - halves[0].bottom}
            cornerRadius={2}
            fill="#c8c2b6"
          />
          {rails.map((rail) => (
            <Line
              key={`rail-${rail.y}`}
              points={[firstColumnX - 10, rail.y, lastColumnX + 10, rail.y]}
              stroke={rail.color}
              strokeWidth={2}
            />
          ))}
          {[halves[0], halves[1]].map((half, halfIndex) =>
            Array.from({ length: BREADBOARD_COLUMNS }, (_unused, index) => (
              <Line
                key={`groove-${halfIndex}-${index}`}
                points={[
                  firstColumnX + index * columnPitch,
                  half.top,
                  firstColumnX + index * columnPitch,
                  half.bottom,
                ]}
                stroke="#c8c2b6"
                strokeWidth={1}
                dash={[2, 4]}
              />
            ))
          )}
        </>
      )
    }

    default: {
      return (
        <Group>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fill={PART_BODY_FILL}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
        </Group>
      )
    }
  }
}
