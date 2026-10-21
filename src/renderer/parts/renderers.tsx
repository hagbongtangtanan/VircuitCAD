import type { JSX } from 'react'
import { Circle, Ellipse, Group, Line, Rect, Text } from 'react-konva'
import type { PartInstance } from '../../shared/circuit'
import { BREADBOARD_COLUMNS, BREADBOARD_LAYOUT, definitionOf } from './definitions'
import {
  LED_COLORS,
  PART_BODY_FILL,
  PART_BODY_STROKE,
  PART_SELECTED_STROKE,
  mixRgbGlow,
} from './partColors'
import { resistorBands } from './resistorBands'

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
  /** Per-switch state for DIP banks. */
  readonly dipBits?: readonly boolean[]
}

/**
 * Draws a part in its own top-left coordinate space. The parent `Group` applies
 * position, rotation and selection styling, so every case here is plain local
 * geometry that matches the pin offsets in `definitions.ts`.
 */

function DipPackage({
  part,
  outline,
  outlineWidth,
}: {
  readonly part: PartInstance
  readonly outline: string
  readonly outlineWidth: number
}): JSX.Element {
  const definition = definitionOf(part.type)
  const { width, height } = definition.size
  const bodyX = 12
  const bodyY = 4
  const bodyWidth = width - 16
  const bodyHeight = height - 8
  return (
    <>
      {definition.pins.map((item) => (
        <Line
          key={`lead-${item.id}`}
          points={
            item.position.x <= 0
              ? [0, item.position.y, bodyX, item.position.y]
              : [width - bodyX, item.position.y, width, item.position.y]
          }
          stroke={PART_BODY_STROKE}
          strokeWidth={2}
        />
      ))}
      <Rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        cornerRadius={3}
        fill="#262b36"
        stroke={outline}
        strokeWidth={outlineWidth}
      />
      <Circle x={width / 2} y={bodyY + 7} radius={3} fill="#151922" />
      <Text
        x={bodyX + 3}
        y={height / 2 - 5}
        width={bodyWidth - 6}
        text={definition.label}
        align="center"
        fontSize={7}
        fill="#d8deea"
        listening={false}
      />
    </>
  )
}

export function PartBody({
  part,
  selected,
  brightness = 0,
  pressed = false,
  potPosition = 0.5,
  switchOn = false,
  channels = {},
  spin = 0,
  dipBits = [],
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
      // Radial electrolytic can: silver top, blue sleeve, polarity stripe.
      return (
        <>
          <Line points={[10, 40, 10, 30]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 40, 30, 23]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Ellipse
            x={20}
            y={28}
            radiusX={14}
            radiusY={4}
            fill="#244b73"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect
            x={6}
            y={5}
            width={28}
            height={23}
            fill="#2f5d8a"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Ellipse
            x={20}
            y={5}
            radiusX={14}
            radiusY={4.5}
            fill="#cfd7e3"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={8} y={5} width={5.5} height={23} fill="#e8eef6" opacity={0.9} />
          <Text x={9} y={9} text="−" fontSize={8} fill="#2f5d8a" fontStyle="bold" />
          <Text x={9} y={18} text="−" fontSize={8} fill="#2f5d8a" fontStyle="bold" />
          <Text x={25} y={21} text="+" fontSize={9} fill="#eef3fa" fontStyle="bold" />
          <Line
            points={[26, 8, 26, 25]}
            stroke="#ffffff"
            opacity={0.18}
            strokeWidth={2}
            listening={false}
          />
        </>
      )

    case 'diode':
      // Axial package with the silver cathode band on the right.
      return (
        <>
          <Line points={[0, 12, 14, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[36, 12, 50, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={14}
            y={4}
            width={22}
            height={16}
            cornerRadius={4}
            fill="#232833"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={31} y={4} width={5} height={16} fill="#c9d0da" />
          <Line
            points={[17, 7, 17, 17]}
            stroke="#ffffff"
            opacity={0.16}
            strokeWidth={2}
            listening={false}
          />
        </>
      )

    case 'inductor':
      // Axial choke: dark ferrite core with copper windings around it.
      return (
        <>
          <Line points={[0, 13, 12, 13]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[48, 13, 60, 13]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={12}
            y={5}
            width={36}
            height={16}
            cornerRadius={6}
            fill="#3a2f28"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Ellipse
              key={`winding-${index}`}
              x={15 + index * 6}
              y={13}
              radiusX={2.4}
              radiusY={8}
              stroke="#c8864a"
              strokeWidth={2}
              listening={false}
            />
          ))}
          <Line
            points={[16, 7, 44, 7]}
            stroke="#ffffff"
            opacity={0.16}
            strokeWidth={1.5}
            listening={false}
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
      const levels = { red: blend('red'), green: blend('green'), blue: blend('blue') }
      const mixed = mixRgbGlow(levels)
      const lit = mixed.strength > 0.01
      const dies: readonly { channel: 'red' | 'green' | 'blue'; x: number; y: number }[] = [
        { channel: 'red', x: 16, y: 17 },
        { channel: 'green', x: 22, y: 14 },
        { channel: 'blue', x: 28, y: 17 },
      ]
      return (
        <>
          {[8, 18, 28, 38].map((x) => (
            <Line
              key={`leg-${x}`}
              points={[x, 52, x, 28]}
              stroke={PART_BODY_STROKE}
              strokeWidth={2}
            />
          ))}
          {lit && (
            <Circle
              x={22}
              y={17}
              radius={13 + 10 * mixed.strength}
              fill={mixed.color}
              opacity={0.35 * mixed.strength}
              shadowColor={mixed.color}
              shadowBlur={22 * mixed.strength}
              shadowOpacity={0.8 * mixed.strength}
              listening={false}
            />
          )}
          <Rect
            x={4}
            y={4}
            width={36}
            height={26}
            cornerRadius={12}
            fill="#e9edf5"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {lit && (
            <Rect
              x={4}
              y={4}
              width={36}
              height={26}
              cornerRadius={12}
              fill={mixed.color}
              opacity={0.55 * mixed.strength}
              listening={false}
            />
          )}
          {dies.map(({ channel, x, y }) => {
            const level = levels[channel]
            return (
              <Circle
                key={channel}
                x={x}
                y={y}
                radius={3.1}
                fill={LED_COLORS[channel].body}
                opacity={0.3 + 0.7 * level}
                stroke={level > 0.02 ? LED_COLORS[channel].glow : undefined}
                strokeWidth={level > 0.02 ? 1 : 0}
                listening={false}
              />
            )
          })}
          <Ellipse
            x={18}
            y={11}
            radiusX={4}
            radiusY={2.4}
            fill="#ffffff"
            opacity={lit ? 0.35 : 0.6}
            listening={false}
          />
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
            y={6}
            width={70}
            height={78}
            cornerRadius={6}
            fill="#1b1e26"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {segments.map(([segment, points]) => (
            <Line
              key={segment}
              points={points}
              stroke={lit(segment) ? palette.glow : '#4d5565'}
              strokeWidth={5}
              lineCap="round"
            />
          ))}
          <Circle x={64} y={78} radius={3} fill={lit('dp') ? palette.glow : '#4d5565'} />
          {definitionOf('seven-segment').pins.map((lead) => {
            const top = lead.position.y === 0
            return (
              <Line
                key={`pin-${lead.id}`}
                points={[lead.position.x, top ? 0 : 90, lead.position.x, top ? 8 : 82]}
                stroke={PART_BODY_STROKE}
                strokeWidth={2}
              />
            )
          })}
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

    case 'electrolytic-capacitor':
      return (
        <>
          <Line points={[10, 40, 10, 30]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 40, 30, 23]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Ellipse
            x={20}
            y={27}
            radiusX={14}
            radiusY={4}
            fill="#1c3d5e"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect
            x={6}
            y={5}
            width={28}
            height={22}
            fill="#2f5d8a"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Ellipse
            x={20}
            y={5}
            radiusX={14}
            radiusY={4.5}
            fill="#cfd7e3"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={8} y={5} width={5} height={22} fill="#e8eef6" opacity={0.9} />
          <Text x={9} y={9} text="−" fontSize={8} fill="#2f5d8a" fontStyle="bold" />
          <Text x={24} y={21} text="+" fontSize={9} fill="#eef3fa" fontStyle="bold" />
          <Text x={15} y={12} text="µF" fontSize={6} fill="#dce6f4" />
        </>
      )

    case 'zener-diode':
      return (
        <>
          <Line points={[0, 12, 14, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[36, 12, 50, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={14}
            y={4}
            width={22}
            height={16}
            cornerRadius={4}
            fill="#232833"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line points={[31, 4, 31, 20]} stroke="#c9d0da" strokeWidth={3} />
          <Line points={[28, 7, 31, 4, 34, 7]} stroke="#c9d0da" strokeWidth={1.5} />
          <Text x={16} y={9} text="Z" fontSize={7} fill="#f0c75e" fontStyle="bold" />
        </>
      )

    case 'light-bulb': {
      const glow = Math.min(1, Math.max(0, brightness))
      return (
        <>
          <Line points={[12, 44, 12, 33]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[32, 44, 32, 33]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          {glow > 0.01 && (
            <Circle
              x={22}
              y={20}
              radius={14 + 8 * glow}
              fill="#ffe9a8"
              opacity={0.25 * glow}
              shadowColor="#ffd45c"
              shadowBlur={20 * glow}
              shadowOpacity={0.8 * glow}
              listening={false}
            />
          )}
          <Circle
            x={22}
            y={19}
            radius={13}
            fill={glow > 0.01 ? '#ffe9a8' : '#dfe6ef'}
            opacity={0.45 + 0.5 * glow}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line
            points={[16, 25, 20, 16, 24, 24, 28, 16]}
            stroke={glow > 0.01 ? '#ffb300' : '#7d8798'}
            strokeWidth={1.5}
            lineJoin="round"
          />
          <Rect x={15} y={30} width={14} height={5} fill="#a5adba" />
        </>
      )
    }

    case 'vibration-motor': {
      const speed = Math.min(1, Math.max(0, channels.speed ?? 0))
      return (
        <>
          <Line points={[12, 44, 12, 36]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[32, 44, 32, 36]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={6}
            y={10}
            width={32}
            height={26}
            cornerRadius={6}
            fill="#3b4252"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={22} y={23} radius={9} fill="#5a6478" />
          <Group x={22} y={23} rotation={spin} listening={false}>
            <Circle x={6} y={0} radius={4} fill={speed > 0.02 ? '#f6c445' : '#8a93a6'} />
          </Group>
          <Text x={10} y={31} text="VIB" fontSize={5} fill="#dce6f4" />
        </>
      )
    }

    case 'gear-motor': {
      const speed = Math.min(1, Math.max(0, channels.speed ?? 0))
      return (
        <>
          <Line points={[18, 50, 18, 42]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[42, 50, 42, 42]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={4}
            y={8}
            width={38}
            height={34}
            cornerRadius={4}
            fill="#59637a"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Group x={42} y={25} rotation={spin} listening={false}>
            {[0, 45, 90, 135].map((angle) => (
              <Line
                key={angle}
                points={[0, 0, 14, 0]}
                stroke={speed > 0.02 ? '#f6c445' : '#9aa4b6'}
                strokeWidth={3}
                rotation={angle}
              />
            ))}
          </Group>
          <Circle x={42} y={25} radius={4} fill="#2b3243" />
          <Text x={9} y={25} text="GEAR" fontSize={7} fill="#dce6f4" />
        </>
      )
    }

    case 'thermistor': {
      const level = Math.min(1, Math.max(0, channels.light ?? 0.5))
      return (
        <>
          <Line points={[10, 44, 10, 31]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[34, 44, 34, 31]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Circle
            x={22}
            y={20}
            radius={12}
            fill="#3a2f28"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={22} y={20} radius={8} fill={level > 0.5 ? '#d9784a' : '#7fa6c9'} />
          <Line
            points={[16, 20, 19, 16, 22, 20, 25, 16, 28, 20]}
            stroke="#f3d7a1"
            strokeWidth={1.5}
          />
        </>
      )
    }

    case 'flex-sensor':
      return (
        <>
          <Line points={[0, 13, 8, 13]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[52, 13, 60, 13]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={8}
            y={6}
            width={44}
            height={14}
            cornerRadius={7}
            fill="#232833"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line points={[14, 13, 46, 13]} stroke="#c8864a" strokeWidth={3} />
          <Line
            points={[14, 9, 20, 9, 26, 17, 32, 9, 38, 17, 46, 9]}
            stroke="#f0c75e"
            strokeWidth={1.2}
          />
        </>
      )

    case 'force-sensor':
      return (
        <>
          <Line points={[10, 44, 10, 34]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[34, 44, 34, 34]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={5}
            y={5}
            width={34}
            height={30}
            cornerRadius={5}
            fill="#2b3243"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={22} y={20} radius={11} fill="#4a5468" stroke="#d6dce7" strokeWidth={1.5} />
          <Circle x={22} y={20} radius={4} fill="#1b1e26" />
          {[8, 36].map((x) => (
            <Line key={x} points={[x, 8, x, 32]} stroke="#7d8798" strokeWidth={1} />
          ))}
        </>
      )

    case 'photodiode':
      return (
        <>
          <Line points={[0, 12, 14, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[36, 12, 50, 12]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={14}
            y={4}
            width={22}
            height={16}
            cornerRadius={4}
            fill="#232833"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line points={[31, 4, 31, 20]} stroke="#c9d0da" strokeWidth={2} />
          {[18, 24].map((x) => (
            <Line
              key={x}
              points={[x, 2, x - 4, -4, x + 2, -8]}
              stroke="#f0c75e"
              strokeWidth={1.3}
            />
          ))}
        </>
      )

    case 'phototransistor':
      return (
        <>
          <Line points={[12, 34, 12, 27]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[38, 34, 38, 27]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Circle
            x={25}
            y={16}
            radius={13}
            fill={channels.light !== undefined && channels.light > 0.5 ? '#cfd7e3' : '#8a93a6'}
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line points={[20, 16, 20, 26, 26, 26, 26, 16]} stroke="#3b4252" strokeWidth={2} />
          <Line points={[26, 22, 33, 16]} stroke="#3b4252" strokeWidth={2} />
          {[36, 42].map((x) => (
            <Line
              key={x}
              points={[x, 2, x - 6, -4, x - 2, -8]}
              stroke="#f0c75e"
              strokeWidth={1.2}
            />
          ))}
        </>
      )

    case 'tilt-sensor': {
      const tilted = (channels.light ?? 0) > 0.5
      return (
        <>
          <Line points={[10, 40, 10, 28]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 40, 30, 28]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={6}
            y={6}
            width={28}
            height={24}
            cornerRadius={12}
            fill="#3b4252"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Circle x={tilted ? 12 : 23} y={tilted ? 14 : 20} radius={5} fill="#c9d0da" />
          <Line points={[14, 10, 26, 26]} stroke="#8a93a6" strokeWidth={1} />
        </>
      )
    }

    case 'soil-moisture':
      return (
        <>
          <Rect
            x={5}
            y={5}
            width={40}
            height={30}
            cornerRadius={3}
            fill="#2b5e3a"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line points={[12, 35, 12, 50]} stroke="#c9d0da" strokeWidth={3} />
          <Line points={[38, 35, 38, 50]} stroke="#c9d0da" strokeWidth={3} />
          <Circle x={17} y={18} radius={4} fill="#6fd3ff" opacity={0.8} />
          <Circle x={28} y={16} radius={3} fill="#6fd3ff" opacity={0.7} />
          <Text x={14} y={28} text="SOIL" fontSize={7} fill="#e6f5ea" />
        </>
      )

    case 'gas-sensor':
      return (
        <>
          {[
            [10, 0],
            [50, 0],
            [0, 16],
            [0, 34],
            [60, 16],
            [60, 34],
          ].map(([x, y], index) => (
            <Circle key={index} x={x} y={y} radius={2.4} fill="#c9d0da" stroke={outline} />
          ))}
          <Circle
            x={30}
            y={25}
            radius={18}
            fill="#4a5468"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {[0, 30, 60, 90, 120, 150].map((angle) => (
            <Line
              key={angle}
              x={30}
              y={25}
              points={[0, -17, 0, 17]}
              stroke="#7d8798"
              strokeWidth={1}
              rotation={angle}
            />
          ))}
          <Circle x={30} y={25} radius={6} fill="#d9784a" />
          <Text x={22} y={42} text="GAS" fontSize={5} fill="#dce6f4" />
        </>
      )

    case 'tmp36':
      return (
        <>
          <Line points={[8, 50, 8, 42]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[28, 50, 28, 42]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[48, 50, 48, 42]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={4}
            y={6}
            width={48}
            height={36}
            cornerRadius={4}
            fill="#2b3243"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Text x={15} y={20} text="TMP" fontSize={8} fill="#e6e9f0" />
          <Text x={15} y={30} text="36" fontSize={8} fill="#e6e9f0" />
        </>
      )

    case 'coin-cell':
      return (
        <>
          <Ellipse
            x={20}
            y={18}
            radiusX={16}
            radiusY={14}
            fill="#c9ced8"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Ellipse x={20} y={16} radiusX={11} radiusY={9} fill="#a5adba" />
          <Text x={12} y={14} text="3V" fontSize={7} fill="#2b3243" fontStyle="bold" />
        </>
      )

    case 'solar-cell': {
      const level = Math.min(1, Math.max(0, channels.light ?? 0.5))
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={56}
            height={36}
            cornerRadius={3}
            fill="#17365c"
            stroke={outline}
            strokeWidth={outlineWidth}
            opacity={0.65 + 0.35 * level}
          />
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((column) => (
              <Rect
                key={`${row}-${column}`}
                x={6 + column * 17}
                y={6 + row * 11}
                width={14}
                height={8}
                fill={level > 0.3 ? '#3f7fc4' : '#244b73'}
                stroke="#8ab6e8"
                strokeWidth={0.8}
              />
            ))
          )}
          <Line points={[0, 20, 60, 20]} stroke="#c9d0da" strokeWidth={1.5} />
        </>
      )
    }

    case 'potato-battery':
      return (
        <>
          <Ellipse
            x={30}
            y={26}
            radiusX={25}
            radiusY={19}
            fill="#9c7a4b"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Ellipse x={24} y={20} radiusX={8} radiusY={4} fill="#b8945f" opacity={0.7} />
          <Line points={[18, 26, 18, 8]} stroke="#c9d0da" strokeWidth={2.5} />
          <Line points={[42, 26, 42, 8]} stroke="#d9784a" strokeWidth={2.5} />
          <Text x={22} y={34} text="0.9V" fontSize={7} fill="#f6ead2" />
        </>
      )

    case 'dip-switch-4':
    case 'dip-switch-6': {
      const count = part.type === 'dip-switch-4' ? 4 : 6
      const pitch = (size.width - 20) / Math.max(1, count - 1)
      return (
        <>
          <Rect
            x={1}
            y={5}
            width={size.width - 2}
            height={26}
            cornerRadius={3}
            fill="#b53a3a"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          {Array.from({ length: count }, (_unused, index) => {
            const x = 10 + index * pitch
            const on = dipBits[index] === true
            return (
              <Group key={index}>
                <Line points={[x, 0, x, 5]} stroke={PART_BODY_STROKE} strokeWidth={2} />
                <Line points={[x, 36, x, 31]} stroke={PART_BODY_STROKE} strokeWidth={2} />
                <Rect
                  x={x - 7}
                  y={on ? 10 : 17}
                  width={14}
                  height={9}
                  cornerRadius={2}
                  fill={on ? '#f2c14e' : '#8a93a6'}
                  stroke={PART_BODY_STROKE}
                />
              </Group>
            )
          })}
        </>
      )
    }

    case 'lm7805':
    case 'ld1117v33':
      return (
        <>
          <Line points={[0, 20, 8, 20]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[52, 20, 60, 20]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[30, 40, 30, 34]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Rect
            x={8}
            y={6}
            width={44}
            height={28}
            cornerRadius={3}
            fill="#2b3243"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Rect x={14} y={30} width={32} height={4} fill="#c9ced8" />
          <Text
            x={13}
            y={16}
            text={part.type === 'lm7805' ? '7805' : '1117'}
            fontSize={8}
            fill="#e6e9f0"
          />
          <Text
            x={17}
            y={26}
            text={part.type === 'lm7805' ? '5V' : '3.3V'}
            fontSize={7}
            fill="#9fd0ff"
          />
        </>
      )

    case 'ir-receiver':
      return (
        <>
          <Rect
            x={4}
            y={4}
            width={42}
            height={34}
            cornerRadius={3}
            fill="#242a36"
            stroke={outline}
          />
          <Rect x={10} y={10} width={12} height={16} fill="#11151d" />
          <Circle x={35} y={16} radius={6} fill="#3b1f1f" stroke="#8e4b4b" />
          <Text x={11} y={31} text="IR" fontSize={7} fill="#cbd4e4" />
        </>
      )

    case 'ultrasonic-3pin':
    case 'ultrasonic-hcsr04': {
      const wide = part.type === 'ultrasonic-hcsr04'
      return (
        <>
          <Rect
            x={3}
            y={4}
            width={size.width - 6}
            height={size.height - 10}
            cornerRadius={3}
            fill="#234a63"
            stroke={outline}
          />
          <Circle
            x={wide ? 22 : 18}
            y={21}
            radius={wide ? 11 : 9}
            fill="#b8c3cf"
            stroke="#59697d"
          />
          <Circle
            x={wide ? 54 : 46}
            y={21}
            radius={wide ? 11 : 9}
            fill="#b8c3cf"
            stroke="#59697d"
          />
          <Circle x={wide ? 22 : 18} y={21} radius={5} fill="#536170" />
          <Circle x={wide ? 54 : 46} y={21} radius={5} fill="#536170" />
          <Text x={wide ? 27 : 22} y={33} text="ULTRA" fontSize={6} fill="#d9e8f4" />
        </>
      )
    }

    case 'pir-sensor':
      return (
        <>
          <Rect
            x={4}
            y={4}
            width={44}
            height={44}
            cornerRadius={22}
            fill="#e3e7ec"
            stroke={outline}
          />
          <Circle x={26} y={25} radius={17} fill="#f4f5f7" stroke="#b8c0cb" />
          {Array.from({ length: 7 }, (_unused, index) => (
            <Circle
              key={index}
              x={15 + index * 3.4}
              y={16 + Math.abs(3 - index) * 1.8}
              radius={2.2}
              fill="#d3d8df"
            />
          ))}
          <Text x={9} y={43} text="PIR" fontSize={7} fill="#334155" />
        </>
      )

    case 'keypad-4x4': {
      const keys = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D']
      return (
        <>
          <Rect
            x={2}
            y={18}
            width={size.width - 4}
            height={size.height - 22}
            cornerRadius={4}
            fill="#353b46"
            stroke={outline}
          />
          {keys.map((key, index) => {
            const column = index % 4
            const row = Math.floor(index / 4)
            return (
              <Group key={key}>
                <Rect
                  x={10 + column * 26}
                  y={25 + row * 20}
                  width={21}
                  height={16}
                  cornerRadius={2}
                  fill="#d9dde4"
                  stroke="#737d8d"
                />
                <Text
                  x={10 + column * 26}
                  y={29 + row * 20}
                  width={21}
                  text={key}
                  align="center"
                  fontSize={8}
                  fill="#1f2937"
                />
              </Group>
            )
          })}
        </>
      )
    }

    case 'neopixel-strip':
    case 'neopixel-ring': {
      const count = Math.max(4, Math.min(24, part.props.pixelCount))
      const color = LED_COLORS[part.props.color].glow
      if (part.type === 'neopixel-ring') {
        return (
          <>
            <Circle x={48} y={48} radius={40} fill="#1d222b" stroke={outline} />
            {Array.from({ length: count }, (_unused, index) => {
              const angle = (index / count) * Math.PI * 2 - Math.PI / 2
              return (
                <Circle
                  key={index}
                  x={48 + Math.cos(angle) * 30}
                  y={48 + Math.sin(angle) * 30}
                  radius={4.5}
                  fill={color}
                />
              )
            })}
            <Circle x={48} y={48} radius={18} fill="#0f131a" />
          </>
        )
      }
      const spacing = (size.width - 24) / Math.max(1, count - 1)
      return (
        <>
          <Rect
            x={2}
            y={4}
            width={size.width - 4}
            height={26}
            cornerRadius={4}
            fill="#1d222b"
            stroke={outline}
          />
          {Array.from({ length: count }, (_unused, index) => (
            <Circle
              key={index}
              x={12 + index * spacing}
              y={17}
              radius={5}
              fill={color}
              stroke="#0c1016"
            />
          ))}
        </>
      )
    }

    case 'ir-remote':
      return (
        <>
          <Rect
            x={5}
            y={2}
            width={34}
            height={84}
            cornerRadius={8}
            fill="#232833"
            stroke={outline}
          />
          <Circle x={22} y={13} radius={6} fill="#c44b4b" />
          {Array.from({ length: 12 }, (_unused, index) => (
            <Rect
              key={index}
              x={11 + (index % 2) * 15}
              y={27 + Math.floor(index / 2) * 9}
              width={9}
              height={6}
              cornerRadius={2}
              fill="#9aa3b3"
            />
          ))}
          <Text x={13} y={77} text="IR" fontSize={7} fill="#e2e8f0" />
        </>
      )

    case 'encoder-motor':
      return (
        <>
          <Rect
            x={2}
            y={18}
            width={42}
            height={38}
            cornerRadius={6}
            fill="#50596a"
            stroke={outline}
          />
          <Circle x={23} y={37} radius={13} fill="#7b8494" stroke="#303743" />
          <Circle x={45} y={37} radius={13} fill="#252b35" stroke={outline} />
          {Array.from({ length: 6 }, (_unused, index) => {
            const angle = (index / 6) * Math.PI * 2
            return (
              <Circle
                key={index}
                x={45 + Math.cos(angle) * 8}
                y={37 + Math.sin(angle) * 8}
                radius={2}
                fill="#aab3c2"
              />
            )
          })}
          <Line points={[2, 37, 0, 37]} stroke={PART_BODY_STROKE} strokeWidth={2} />
        </>
      )

    case 'servo':
      return (
        <>
          <Rect
            x={3}
            y={18}
            width={58}
            height={36}
            cornerRadius={3}
            fill="#2b4b6b"
            stroke={outline}
          />
          <Rect
            x={12}
            y={2}
            width={40}
            height={18}
            cornerRadius={2}
            fill="#32587d"
            stroke={outline}
          />
          <Circle x={32} y={27} radius={9} fill="#d7dce4" stroke="#6c7687" />
          <Line points={[32, 27, 54, 20]} stroke="#e6e9ef" strokeWidth={3} lineCap="round" />
          <Circle x={32} y={27} radius={2.5} fill="#2e3744" />
          <Text x={17} y={39} text="SERVO" fontSize={7} fill="#e3ebf5" />
        </>
      )

    case 'lcd-16x2':
    case 'lcd-16x2-i2c':
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 16}
            cornerRadius={3}
            fill="#2f6b4f"
            stroke={outline}
          />
          <Rect
            x={8}
            y={8}
            width={size.width - 16}
            height={size.height - 32}
            fill="#9dbf75"
            stroke="#3f5c36"
          />
          <Text
            x={12}
            y={16}
            text="Hello, HuCAD!"
            fontSize={part.type === 'lcd-16x2' ? 11 : 9}
            fill="#1e3a24"
            fontFamily="monospace"
          />
          <Text
            x={12}
            y={32}
            text="16x2 LCD"
            fontSize={part.type === 'lcd-16x2' ? 10 : 8}
            fill="#1e3a24"
            fontFamily="monospace"
          />
        </>
      )

    case 'seven-segment-clock':
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 14}
            cornerRadius={3}
            fill="#161a21"
            stroke={outline}
          />
          <Text x={8} y={12} text="12:34" fontSize={24} fill="#f87171" fontFamily="monospace" />
          <Text x={85} y={20} text=":56" fontSize={12} fill="#f87171" fontFamily="monospace" />
        </>
      )

    case 'microbit':
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 10}
            cornerRadius={5}
            fill="#1d6a5a"
            stroke={outline}
          />
          {Array.from({ length: 25 }, (_unused, index) => (
            <Rect
              key={index}
              x={38 + (index % 5) * 9}
              y={20 + Math.floor(index / 5) * 9}
              width={6}
              height={6}
              fill={index % 3 === 0 ? '#f87171' : '#163c34'}
            />
          ))}
          <Circle x={22} y={18} radius={4} fill="#f9d65c" />
          <Circle x={22} y={30} radius={4} fill="#65a7ff" />
          <Text x={10} y={48} text="micro:bit" fontSize={8} fill="#e8f2ee" />
          {Array.from({ length: 5 }, (_unused, index) => (
            <Rect
              key={`edge-${index}`}
              x={8 + index * 22}
              y={size.height - 10}
              width={12}
              height={8}
              fill="#d3ad52"
            />
          ))}
        </>
      )

    case 'multimeter': {
      const modeLabel = part.props.mode === 'volts' ? 'V' : part.props.mode === 'amps' ? 'A' : 'Ω'
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 18}
            cornerRadius={5}
            fill="#d8a63a"
            stroke={outline}
          />
          <Rect
            x={10}
            y={10}
            width={72}
            height={24}
            cornerRadius={2}
            fill="#b6c2a1"
            stroke="#65705a"
          />
          <Text
            x={18}
            y={16}
            text={`0.00 ${modeLabel}`}
            fontSize={13}
            fill="#1e2b1e"
            fontFamily="monospace"
          />
          <Circle x={46} y={68} radius={22} fill="#2b3038" stroke="#151920" />
          <Line points={[46, 68, 46, 51]} stroke="#f8fafc" strokeWidth={3} lineCap="round" />
          <Text x={38} y={92} text="DMM" fontSize={8} fill="#292012" />
        </>
      )
    }

    case 'function-generator':
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 10}
            cornerRadius={4}
            fill="#3d4656"
            stroke={outline}
          />
          <Rect x={8} y={8} width={84} height={28} fill="#b9d1ae" stroke="#536451" />
          <Line
            points={[12, 26, 22, 12, 32, 26, 42, 12, 52, 26, 62, 12, 72, 26, 82, 12]}
            stroke="#1d4e2c"
            strokeWidth={1.5}
          />
          <Text
            x={10}
            y={43}
            text={`${part.props.waveform} ${part.props.frequencyHz}Hz`}
            fontSize={7}
            fill="#eef2f8"
          />
          <Text
            x={10}
            y={54}
            text={`${part.props.amplitudeVolts}Vpp`}
            fontSize={7}
            fill="#a8d5ff"
          />
        </>
      )

    case 'oscilloscope':
      return (
        <>
          <Rect
            x={2}
            y={2}
            width={size.width - 4}
            height={size.height - 10}
            cornerRadius={4}
            fill="#303844"
            stroke={outline}
          />
          <Rect x={8} y={8} width={114} height={62} fill="#0e1a14" stroke="#3b5a47" />
          <Line
            points={[
              12, 39, 28, 39, 34, 18, 42, 60, 50, 39, 66, 39, 72, 24, 80, 54, 90, 39, 116, 39,
            ]}
            stroke="#63e6a7"
            strokeWidth={1.5}
          />
          <Text x={12} y={60} text="CH1 1V/div" fontSize={6} fill="#72c99b" />
        </>
      )

    case 'header-8':
      return (
        <>
          <Rect
            x={3}
            y={6}
            width={size.width - 6}
            height={18}
            cornerRadius={2}
            fill="#242a34"
            stroke={outline}
          />
          {Array.from({ length: 8 }, (_unused, index) => (
            <Rect
              key={index}
              x={8 + index * 12}
              y={10}
              width={7}
              height={10}
              fill="#d1a84a"
              stroke="#6e5520"
            />
          ))}
        </>
      )

    case 'usb-a':
      return (
        <>
          <Rect
            x={4}
            y={8}
            width={size.width - 8}
            height={28}
            cornerRadius={4}
            fill="#b9bec7"
            stroke={outline}
          />
          <Rect x={12} y={14} width={size.width - 24} height={16} fill="#777f8c" />
          <Rect x={18} y={18} width={size.width - 36} height={8} fill="#343a44" />
          <Text x={30} y={38} text="USB-A" fontSize={7} fill="#1f2937" />
        </>
      )

    case 'transistor-npn':
    case 'transistor-pnp':
    case 'tip120':
    case 'mosfet-n':
    case 'mosfet-p': {
      const isMosfet = part.type === 'mosfet-n' || part.type === 'mosfet-p'
      return (
        <>
          <Circle
            x={28}
            y={30}
            radius={25}
            fill="#2d3440"
            stroke={outline}
            strokeWidth={outlineWidth}
          />
          <Line points={[16, 30, 28, 30]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[28, 16, 28, 44]} stroke={PART_BODY_STROKE} strokeWidth={3} />
          <Line points={[28, 21, 44, 10]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          <Line points={[28, 39, 44, 50]} stroke={PART_BODY_STROKE} strokeWidth={2} />
          {isMosfet ? (
            <Text x={15} y={48} text="MOS" fontSize={6} fill="#cbd5e1" />
          ) : (
            <Line points={[38, 34, 44, 40]} stroke="#d1d9e6" strokeWidth={1.5} />
          )}
        </>
      )
    }

    case 'relay-spdt':
    case 'relay-dpdt':
      return (
        <>
          <Rect
            x={2}
            y={4}
            width={size.width - 4}
            height={size.height - 10}
            cornerRadius={3}
            fill="#29506b"
            stroke={outline}
          />
          <Rect x={10} y={12} width={34} height={26} fill="#b98545" stroke="#5f4322" />
          <Text x={17} y={20} text="COIL" fontSize={7} fill="#2b1d0e" />
          <Line points={[52, 18, 68, 18]} stroke="#d5d9df" strokeWidth={1.5} />
          <Line points={[52, 32, 68, 32]} stroke="#d5d9df" strokeWidth={1.5} />
          <Line points={[68, 18, 58, 25]} stroke="#f3cf6a" strokeWidth={2} />
          <Text x={70} y={42} text="RELAY" fontSize={6} fill="#e2edf7" />
        </>
      )

    case 'breadboard-small':
    case 'breadboard-mini': {
      const definition = definitionOf(part.type)
      return (
        <>
          <Rect
            x={1}
            y={1}
            width={size.width - 2}
            height={size.height - 2}
            cornerRadius={4}
            fill="#e3dfd0"
            stroke={outline}
          />
          {definition.pins.map((item) => (
            <Circle
              key={item.id}
              x={item.position.x}
              y={item.position.y}
              radius={1.8}
              fill="#4a5160"
            />
          ))}
          <Line
            points={[12, size.height / 2, size.width - 12, size.height / 2]}
            stroke="#b5ab94"
            strokeWidth={1}
          />
        </>
      )
    }

    case 'ic-555':
    case 'ic-556':
    case 'opamp-741':
    case 'comparator-lm393':
    case 'comparator-lm339':
    case 'optocoupler-4n35':
    case 'l293d':
    case '74hc00':
    case '74hc02':
    case '74hc08':
    case '74hc32':
    case '74hc86':
    case '74hc04':
    case '74hc14':
    case '74hc131':
    case '74hc132':
    case '74hc10':
    case '74hc11':
    case '74hc27':
    case '74hc20':
    case '74hc21':
    case '74hc73':
    case '74hc74':
    case '74hc75':
    case '74hc93':
    case '74hc283':
    case '74hc595':
    case '74hc4017':
    case 'cd4511':
    case 'attiny85':
      return <DipPackage part={part} outline={outline} outlineWidth={outlineWidth} />

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
