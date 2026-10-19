import type { JSX } from 'react'
import { Circle, Ellipse, Group, Line, Rect, Text } from 'react-konva'
import type { PartInstance } from '../../shared/circuit'
import { BREADBOARD_COLUMNS, BREADBOARD_LAYOUT, definitionOf } from './definitions'
import { LED_COLORS, PART_BODY_FILL, PART_BODY_STROKE, PART_SELECTED_STROKE } from './partColors'
import { resistorBands } from './resistorBands'

const SEGMENT_PINS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const

export interface PartBodyProps {
  readonly part: PartInstance
  readonly selected: boolean
  /** 0 to 1, only meaningful for light-emitting parts. */
  readonly brightness?: number
  /** True while a momentary control (push button) is held down. */
  readonly pressed?: boolean
  /** 0 to 1 wiper position for potentiometers. */
  readonly potPosition?: number
  /** Latched state for switches. */
  readonly switchOn?: boolean
  /** Per-die brightness for multi-element parts, keyed by channel or segment. */
  readonly channels?: Readonly<Record<string, number>>
  /** Degrees of rotation for spinning parts such as motors. */
  readonly spin?: number
}

/**
 * Draws a part in its own top-left coordinate space. The parent `Group` applies
 * position, rotation and selection styling, so every case here is plain local
 * geometry that matches the pin offsets in `definitions.ts`.
 */
export function PartBody({
  part,
  selected,
  brightness = 0,
  pressed = false,
  potPosition = 0.5,
  switchOn = false,
  channels = {},
  spin = 0,
}: PartBodyProps): JSX.Element {
  const outline = selected ? PART_SELECTED_STROKE : PART_BODY_STROKE
  const outlineWidth = selected ? 2 : 1
  const size = definitionOf(part.type).size

  switch (part.type) {
    case 'led': {
      const palette = LED_COLORS[part.props.color]
      const glow = Math.min(1, Math.max(0, brightness))
      return (
        <>
          {glow > 0.01 && (
            <Circle
              x={20}
              y={16}
              radius={13 + 9 * glow}
              fill={palette.glow}
              opacity={0.4 * glow}
              shadowColor={palette.glow}
              shadowBlur={20 * glow}
              shadowOpacity={0.8 * glow}
              listening={false}
            />
          )}
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
          <Ellipse
            x={17}
            y={13}
            radiusX={glow > 0.01 ? 6 : 4}
            radiusY={glow > 0.01 ? 5 : 3}
            fill={palette.glow}
            opacity={glow > 0.01 ? 0.35 + 0.6 * glow : 0.85}
          />
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
          <Circle
            x={20}
            y={pressed ? 21.5 : 20}
            radius={8}
            fill={pressed ? '#59637a' : '#3b4252'}
            stroke={PART_BODY_STROKE}
          />
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
          {(() => {
            const sweep = Math.min(1, Math.max(0, potPosition))
            const angle = ((-135 + 270 * sweep) * Math.PI) / 180
            return (
              <Line
                points={[30, 20, 30 + Math.cos(angle) * 5, 20 + Math.sin(angle) * 5]}
                stroke="#e7ebf3"
                strokeWidth={1.5}
                lineCap="round"
              />
            )
          })()}
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

    case 'capacitor':
      return (
        <>
          <Line points={[10, 40, 10, 30]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 24, 30, 40]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[5, 30, 35, 30]} stroke={outline} strokeWidth={2.5} />
          <Line points={[5, 24, 35, 24]} stroke={outline} strokeWidth={2.5} />
          <Text x={14} y={36} text="+" fontSize={10} fill="#6d7889" />
        </>
      )

    case 'diode':
      return (
        <>
          <Line points={[0, 12, 14, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[34, 12, 50, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line
            points={[14, 3, 14, 21, 34, 12, 14, 3]}
            stroke={outline}
            strokeWidth={1.5}
            closed
            fill="#2b3243"
          />
          <Line points={[34, 3, 34, 21]} stroke={outline} strokeWidth={2.5} />
        </>
      )

    case 'inductor':
      return (
        <>
          <Line points={[0, 13, 12, 13]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[48, 13, 60, 13]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line
            points={[12, 13, 15, 5, 21, 5, 24, 13, 27, 5, 33, 5, 36, 13, 39, 5, 45, 5, 48, 13]}
            stroke="#b9895a"
            strokeWidth={2.5}
            tension={0.6}
          />
        </>
      )

    case 'slide-switch':
      return (
        <>
          <Rect
            x={0}
            y={4}
            width={56}
            height={22}
            cornerRadius={4}
            fill={PART_BODY_FILL}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect
            x={switchOn ? 28 : 6}
            y={7}
            width={22}
            height={16}
            cornerRadius={3}
            fill="#4a5468"
            stroke={PART_BODY_STROKE}
          />
          <Line points={[0, 15, 0, 15]} stroke={PART_BODY_STROKE} strokeWidth={2} />
        </>
      )

    case 'ldr': {
      const level = Math.min(1, Math.max(0, channels.light ?? 0.5))
      return (
        <>
          <Line points={[10, 44, 10, 31]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[34, 44, 34, 31]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Circle
            x={22}
            y={18}
            radius={13}
            fill={level > 0.5 ? '#f4d97a' : '#c9b98a'}
            stroke={outline}
            strokeWidth={outlineWidth}
            opacity={0.5 + 0.5 * level}
          />
          <Line
            points={[13, 14, 20, 22, 27, 12, 31, 20]}
            stroke="#7a6a43"
            strokeWidth={1.5}
            lineJoin="round"
          />
        </>
      )
    }

    case 'rgb-led': {
      const blend = (channel: 'red' | 'green' | 'blue'): number =>
        Math.min(1, Math.max(0, channels[channel] ?? 0))
      const glow = Math.max(blend('red'), blend('green'), blend('blue'))
      return (
        <>
          {(['red', 'green', 'blue'] as const).map((channel) =>
            blend(channel) > 0.01 ? (
              <Circle
                key={channel}
                x={22}
                y={16}
                radius={12 + 8 * blend(channel)}
                fill={LED_COLORS[channel].glow}
                opacity={0.35 * blend(channel)}
                listening={false}
              />
            ) : null
          )}
          {[8, 18, 28, 38].map((x) => (
            <Line
              key={`leg-${x}`}
              points={[x, 52, x, 28]}
              stroke={PART_BODY_STROKE}
              strokeWidth={2}
            />
          ))}
          <Rect
            x={4}
            y={4}
            width={36}
            height={26}
            cornerRadius={12}
            fill="#e9edf5"
            stroke={outline}
            strokeWidth={outlineWidth}
            opacity={0.95}
          />
          <Circle x={22} y={16} radius={9} fill="#ffffff" opacity={glow > 0.01 ? 0.2 : 0.55} />
        </>
      )
    }

    case 'seven-segment': {
      const palette = LED_COLORS[part.props.color]
      const lit = (segment: string): boolean => (channels[segment] ?? 0) > 0.02
      const segments: readonly (readonly [string, number[]])[] = [
        ['a', [14, 18, 56, 18]],
        ['b', [58, 22, 58, 46]],
        ['c', [58, 50, 58, 74]],
        ['d', [14, 78, 56, 78]],
        ['e', [12, 50, 12, 74]],
        ['f', [12, 22, 12, 46]],
        ['g', [14, 48, 56, 48]],
      ]
      return (
        <>
          <Rect
            x={0}
            y={0}
            width={70}
            height={88}
            cornerRadius={6}
            fill="#23262f"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {segments.map(([segment, points]) => (
            <Line
              key={segment}
              points={points}
              stroke={lit(segment) ? palette.glow : '#3a3f4b'}
              strokeWidth={5}
              lineCap="round"
            />
          ))}
          <Circle x={64} y={78} radius={3} fill={lit('dp') ? palette.glow : '#3a3f4b'} />
          {SEGMENT_PINS.map((segment, index) => (
            <Line
              key={`pin-${segment}`}
              points={[8 + index * 8, 88, 8 + index * 8, 82]}
              stroke={PART_BODY_STROKE}
              strokeWidth={2}
            />
          ))}
          <Line points={[4, 88, 4, 82]} stroke={PART_BODY_STROKE} strokeWidth={2} />
        </>
      )
    }

    case 'dc-motor': {
      const speed = Math.min(1, Math.max(0, channels.speed ?? 0))
      return (
        <>
          <Line points={[14, 56, 14, 44]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[42, 56, 42, 44]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={0}
            y={0}
            width={56}
            height={46}
            cornerRadius={8}
            fill={PART_BODY_FILL}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={28} y={23} radius={15} fill="#4a5468" />
          <Group x={28} y={23} rotation={spin} listening={false}>
            {[0, 60, 120].map((angle) => (
              <Line
                key={angle}
                points={[0, 0, 12, 0]}
                stroke={speed > 0.02 ? '#f6c445' : '#8a93a6'}
                strokeWidth={3}
                rotation={angle}
              />
            ))}
          </Group>
          {speed > 0.02 && (
            <Circle
              x={28}
              y={23}
              radius={17}
              stroke="#f6c445"
              strokeWidth={1.5}
              opacity={0.2 + 0.5 * speed}
              listening={false}
            />
          )}
        </>
      )
    }

    case 'battery-aa':
      return (
        <>
          <Rect
            x={2}
            y={4}
            width={60}
            height={22}
            cornerRadius={4}
            fill="#2b3243"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={56} y={10} width={8} height={10} fill="#c9ced8" />
          <Text x={10} y={11} text="1.5 V" fontSize={9} fill="#e6e9f0" />
        </>
      )

    case 'battery-9v':
      return (
        <>
          <Rect
            x={4}
            y={6}
            width={48}
            height={30}
            cornerRadius={4}
            fill="#2b3243"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={16} y={2} width={8} height={6} fill="#c9ced8" />
          <Rect x={36} y={2} width={8} height={6} fill="#c9ced8" />
          <Text x={16} y={18} text="9 V" fontSize={10} fill="#e6e9f0" />
        </>
      )

    case 'power-supply':
      return (
        <>
          <Rect
            x={2}
            y={6}
            width={56}
            height={34}
            cornerRadius={4}
            fill="#3b4252"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={44} y={2} width={6} height={6} fill="#c9ced8" />
          <Rect x={10} y={2} width={6} height={6} fill="#c9ced8" />
          <Text x={14} y={20} text="5V" fontSize={11} fill="#e6e9f0" />
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
