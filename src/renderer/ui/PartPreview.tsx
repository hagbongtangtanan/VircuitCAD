import type { JSX, ReactNode } from 'react'
import type { PartType } from '../../shared/circuit'

const INK = '#07121f'
const METAL = '#c7d4e2'
const METAL_DARK = '#788ba3'
const BOARD = '#0d7f95'
const CREAM = '#eee9dd'

function leads(points: readonly (readonly [number, number, number, number])[]): ReactNode {
  return points.map(([x1, y1, x2, y2], index) => (
    <line
      key={index}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={METAL_DARK}
      strokeWidth={2.4}
      strokeLinecap="round"
    />
  ))
}

function dippedBody(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  band?: string
): ReactNode {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={height / 2}
        fill={fill}
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={x + 3} y={y + 2} width={width - 8} height={2} rx={1} fill="#ffffff" opacity={0.18} />
      {band !== undefined && (
        <rect x={x + width * 0.68} y={y} width={4.5} height={height} fill={band} opacity={0.95} />
      )}
    </>
  )
}

function ArduinoPreview(): JSX.Element {
  return (
    <>
      <rect x={6} y={8} width={84} height={40} rx={3} fill={BOARD} stroke={INK} strokeWidth={1.2} />
      <rect x={10} y={8} width={36} height={5} fill="#0a6673" stroke="#084f59" strokeWidth={0.5} />
      {Array.from({ length: 8 }, (_unused, index) => (
        <rect
          key={`uno-top-left-${index}`}
          x={12 + index * 4.4}
          y={9}
          width={3}
          height={3}
          fill="#d9b24a"
        />
      ))}
      <rect x={52} y={8} width={30} height={5} fill="#0a6673" stroke="#084f59" strokeWidth={0.5} />
      {Array.from({ length: 6 }, (_unused, index) => (
        <rect
          key={`uno-top-right-${index}`}
          x={54 + index * 4.8}
          y={9}
          width={3}
          height={3}
          fill="#d9b24a"
        />
      ))}
      <rect x={10} y={43} width={24} height={5} fill="#0a6673" stroke="#084f59" strokeWidth={0.5} />
      {Array.from({ length: 5 }, (_unused, index) => (
        <rect
          key={`uno-bottom-left-${index}`}
          x={12 + index * 4.5}
          y={44}
          width={3}
          height={3}
          fill="#d9b24a"
        />
      ))}
      <rect x={52} y={43} width={30} height={5} fill="#0a6673" stroke="#084f59" strokeWidth={0.5} />
      {Array.from({ length: 6 }, (_unused, index) => (
        <rect
          key={`uno-bottom-right-${index}`}
          x={54 + index * 4.8}
          y={44}
          width={3}
          height={3}
          fill="#d9b24a"
        />
      ))}
      <rect x={6} y={15} width={11} height={8} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={6} y={33} width={9} height={10} rx={1} fill="#151a20" stroke="#070a0d" />
      <circle cx={8.5} cy={38} r={2} fill="#2a313a" />
      <circle cx={22} cy={18} r={2.2} fill={METAL} stroke={METAL_DARK} strokeWidth={0.6} />
      <rect x={36} y={20} width={17} height={18} rx={1} fill="#171b20" stroke="#070a0d" />
      {Array.from({ length: 7 }, (_unused, index) => (
        <g key={`uno-chip-${index}`}>
          <rect x={34} y={22 + index * 2.2} width={2} height={1.2} fill={METAL} />
          <rect x={53} y={22 + index * 2.2} width={2} height={1.2} fill={METAL} />
        </g>
      ))}
      <ellipse cx={60} cy={28} rx={5} ry={3} fill={METAL} stroke={METAL_DARK} strokeWidth={0.5} />
      <circle cx={70} cy={18} r={1.2} fill="#4ade80" />
      <circle cx={76} cy={18} r={1.2} fill="#fbbf24" />
      <circle cx={82} cy={18} r={1.2} fill="#fbbf24" />
      <text x={58} y={38.5} fontSize={4} fill="#eaf4ee" fontFamily="monospace">
        UNO R3
      </text>
    </>
  )
}

function RaspberryPiPreview(): JSX.Element {
  return (
    <>
      <rect
        x={6}
        y={10}
        width={84}
        height={40}
        rx={3}
        fill="#2f7d4f"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={14} y={8} width={68} height={6} fill="#276b43" stroke="#1f5736" />
      {Array.from({ length: 20 }, (_unused, index) => (
        <g key={`pi-header-${index}`}>
          <rect x={16 + index * 3.4} y={9} width={1.6} height={1.6} fill="#d9b24a" />
          <rect x={16 + index * 3.4} y={12} width={1.6} height={1.6} fill="#d9b24a" />
        </g>
      ))}
      <rect x={6} y={16} width={7} height={5} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={6} y={23} width={8} height={4} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={6} y={29} width={8} height={4} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={6} y={36} width={8} height={7} rx={1} fill="#171b20" stroke="#080b0e" />
      <circle cx={9} cy={39.5} r={1.5} fill="#2a313a" />
      <rect x={83} y={17} width={7} height={9} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={83} y={28} width={7} height={8} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={83} y={38} width={7} height={8} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={40} y={20} width={13} height={13} rx={1} fill="#171b20" />
      <rect x={43} y={23} width={7} height={7} fill="#8f9aa6" />
      <rect x={24} y={35} width={16} height={11} rx={1} fill={METAL} stroke={METAL_DARK} />
      <rect x={56} y={44} width={12} height={5} rx={1} fill={METAL} stroke={METAL_DARK} />
      {[
        [10, 14],
        [86, 14],
        [10, 46],
        [86, 46],
      ].map(([x, y]) => (
        <circle
          key={`pi-hole-${x}-${y}`}
          cx={x}
          cy={y}
          r={1.4}
          fill="#1f5c38"
          stroke={METAL}
          strokeWidth={0.5}
        />
      ))}
      <text x={42} y={48} fontSize={4} fill="#eaf4ee" fontFamily="monospace">
        Pi 4
      </text>
    </>
  )
}

function BreadboardPreview({
  variant = 'full',
}: {
  readonly variant?: 'full' | 'small' | 'mini'
}): JSX.Element {
  const columns = variant === 'full' ? 14 : variant === 'small' ? 10 : 7
  const spacing = 70 / (columns - 1)
  return (
    <>
      <rect x={8} y={9} width={80} height={38} rx={4} fill={CREAM} stroke={INK} strokeWidth={1.2} />
      <rect x={13} y={12} width={70} height={2.2} rx={1.1} fill="#d59b35" />
      <rect x={13} y={42} width={70} height={2.2} rx={1.1} fill="#d59b35" />
      <rect x={13} y={15.5} width={70} height={2.2} rx={1.1} fill="#3d7fc7" />
      <rect x={13} y={38.5} width={70} height={2.2} rx={1.1} fill="#3d7fc7" />
      {Array.from({ length: columns }, (_unused, column) =>
        Array.from({ length: 6 }, (_unusedRow, row) => (
          <circle
            key={`${column}-${row}`}
            cx={13 + column * spacing}
            cy={21 + row * 3.6}
            r={0.9}
            fill="#7d7f78"
          />
        ))
      )}
      <rect x={13} y={27.2} width={70} height={2.2} rx={1.1} fill="#d1cbbd" />
    </>
  )
}

function PassivePreview({ type }: { readonly type: PartType }): JSX.Element {
  if (type === 'resistor') {
    return (
      <>
        {leads([
          [6, 28, 25, 28],
          [71, 28, 90, 28],
        ])}
        <rect
          x={25}
          y={19}
          width={46}
          height={18}
          rx={7}
          fill="#d9cfad"
          stroke={INK}
          strokeWidth={1.2}
        />
        <rect x={31} y={19} width={5} height={18} fill="#c0392b" />
        <rect x={40} y={19} width={5} height={18} fill="#c0392b" />
        <rect x={49} y={19} width={5} height={18} fill="#6b4a2f" />
        <rect x={63} y={19} width={4} height={18} fill="#d4a017" />
        <rect x={27} y={21} width={38} height={2} rx={1} fill="#ffffff" opacity={0.28} />
      </>
    )
  }
  if (type === 'capacitor') {
    return (
      <>
        {leads([
          [43, 42, 43, 32],
          [53, 42, 53, 25],
        ])}
        <rect
          x={31}
          y={10}
          width={24}
          height={24}
          rx={4}
          fill="#2b5d8e"
          stroke={INK}
          strokeWidth={1.3}
        />
        <ellipse cx={43} cy={10} rx={12} ry={4} fill={METAL} stroke={INK} strokeWidth={1.2} />
        <ellipse cx={43} cy={33} rx={12} ry={3} fill="#1b3c5d" />
        <rect x={34} y={10} width={5} height={23} fill="#dce8f3" />
        <text x={34.6} y={23} fontSize={7} fill="#2b5d8e" fontWeight="700">
          −
        </text>
        <text x={49} y={28} fontSize={7} fill="#ffffff" fontWeight="700">
          +
        </text>
      </>
    )
  }
  if (type === 'electrolytic-capacitor') {
    return (
      <>
        {leads([
          [42, 44, 42, 35],
          [54, 44, 54, 27],
        ])}
        <rect
          x={30}
          y={9}
          width={27}
          height={27}
          rx={4}
          fill="#1c4f7d"
          stroke={INK}
          strokeWidth={1.2}
        />
        <ellipse cx={43.5} cy={9} rx={13.5} ry={4.5} fill={METAL} stroke={INK} strokeWidth={1.1} />
        <ellipse cx={43.5} cy={36} rx={13.5} ry={3} fill="#12324e" />
        <rect x={33} y={9} width={6} height={27} fill="#eef4fa" opacity={0.95} />
        <text x={34} y={20} fontSize={7} fill="#1c4f7d" fontWeight="700">
          −
        </text>
        <text x={50} y={29} fontSize={7} fill="#ffffff" fontWeight="700">
          +
        </text>
      </>
    )
  }
  if (type === 'inductor') {
    return (
      <>
        {leads([
          [6, 28, 24, 28],
          [72, 28, 90, 28],
        ])}
        <rect
          x={24}
          y={20}
          width={48}
          height={16}
          rx={7}
          fill="#3a2f28"
          stroke={INK}
          strokeWidth={1.2}
        />
        {Array.from({ length: 7 }, (_unused, index) => (
          <ellipse
            key={index}
            cx={28 + index * 6.4}
            cy={28}
            rx={2.5}
            ry={8}
            fill="none"
            stroke="#c8864a"
            strokeWidth={2}
          />
        ))}
      </>
    )
  }
  const zener = type === 'zener-diode'
  return (
    <>
      {leads([
        [6, 28, 30, 28],
        [66, 28, 90, 28],
      ])}
      {dippedBody(30, 20, 36, 16, '#232833', METAL)}
      {zener && (
        <path d="M58 19 L58 33 L53 30 M58 19 L63 22" fill="none" stroke={METAL} strokeWidth={1.6} />
      )}
      {!zener && (
        <path
          d="M54 20 L54 36 L60 32 M54 20 L48 24"
          fill="none"
          stroke={METAL}
          strokeWidth={1.3}
          opacity={0.9}
        />
      )}
    </>
  )
}

function LedPreview({ type }: { readonly type: string }): JSX.Element {
  const rgb = type === 'rgb-led'
  if (rgb) {
    return (
      <>
        {leads([
          [33, 32, 33, 52],
          [43, 32, 43, 52],
          [53, 32, 53, 52],
          [63, 32, 63, 52],
        ])}
        <path
          d="M31 25 A17 17 0 0 1 65 25 V32 H31 Z"
          fill="#dfe8f2"
          stroke={INK}
          strokeWidth={1.4}
        />
        <path d="M34 25 A14 14 0 0 1 62 25 V30 H34 Z" fill="#f3f7fb" opacity={0.85} />
        <circle cx={42} cy={23} r={2.8} fill="#e5484d" />
        <circle cx={48} cy={20} r={2.8} fill="#46a758" />
        <circle cx={54} cy={23} r={2.8} fill="#3b82f6" />
        <ellipse cx={42} cy={16} rx={4.2} ry={2.2} fill="#ffffff" opacity={0.65} />
        <line x1={31} y1={32} x2={65} y2={32} stroke={METAL_DARK} strokeWidth={1.2} />
      </>
    )
  }
  return (
    <>
      {leads([
        [42, 32, 42, 52],
        [54, 32, 54, 48],
      ])}
      <path d="M33 25 A15 15 0 0 1 63 25 V32 H33 Z" fill="#ef6b71" stroke={INK} strokeWidth={1.4} />
      <path d="M36 25 A12 12 0 0 1 60 25 V30 H36 Z" fill="#ff9a9e" opacity={0.65} />
      <rect x={44} y={23} width={8} height={6} rx={1} fill="#b71c1c" />
      <ellipse cx={42} cy={17} rx={4.2} ry={2.4} fill="#ffffff" opacity={0.55} />
      <line x1={33} y1={32} x2={63} y2={32} stroke={METAL_DARK} strokeWidth={1.2} />
      <line x1={61} y1={30} x2={64} y2={33} stroke={METAL_DARK} strokeWidth={1.2} />
    </>
  )
}

function BatteryPreview({ type }: { readonly type: string }): JSX.Element {
  if (type === 'battery-9v') {
    return (
      <>
        <rect
          x={20}
          y={10}
          width={56}
          height={36}
          rx={4}
          fill="#233349"
          stroke={INK}
          strokeWidth={1.3}
        />
        <rect x={34} y={5} width={8} height={7} rx={1} fill={METAL} stroke={METAL_DARK} />
        <rect x={54} y={5} width={8} height={7} rx={1} fill={METAL} stroke={METAL_DARK} />
        <text x={32} y={15} fontSize={4.5} fill="#f4d27a" fontWeight="700">
          +
        </text>
        <text x={54} y={15} fontSize={4.5} fill="#9db6d5" fontWeight="700">
          −
        </text>
        <text x={35} y={31} fontSize={13} fill="#eef4fa" fontWeight="700" fontFamily="monospace">
          9V
        </text>
        <text x={25} y={43} fontSize={5} fill="#9fb6d0">
          ALKALINE
        </text>
      </>
    )
  }
  if (type === 'coin-cell') {
    return (
      <>
        <ellipse cx={48} cy={28} rx={25} ry={18} fill={METAL} stroke={INK} strokeWidth={1.3} />
        <ellipse cx={48} cy={26} rx={18} ry={12} fill="#aebccb" />
        <text x={39} y={30} fontSize={9} fill="#203246" fontWeight="700" fontFamily="monospace">
          3V
        </text>
        <text x={67} y={20} fontSize={7} fill="#203246" fontWeight="700">
          +
        </text>
      </>
    )
  }
  return (
    <>
      <rect
        x={10}
        y={18}
        width={68}
        height={22}
        rx={5}
        fill="#25364d"
        stroke={INK}
        strokeWidth={1.3}
      />
      <rect x={72} y={24} width={9} height={10} rx={2} fill={METAL} stroke={METAL_DARK} />
      <rect x={10} y={22} width={62} height={3} fill="#d7a53b" />
      <text x={21} y={33} fontSize={9} fill="#eef4fa" fontWeight="700" fontFamily="monospace">
        AA 1.5V
      </text>
      <text x={13} y={27} fontSize={7} fill="#9db6d5" fontWeight="700">
        −
      </text>
      <text x={70} y={27} fontSize={7} fill="#f4d27a" fontWeight="700">
        +
      </text>
    </>
  )
}

function InputPreview({ type }: { readonly type: PartType }): JSX.Element {
  if (type === 'push-button') {
    return (
      <>
        {leads([
          [0, 28, 17, 28],
          [79, 28, 96, 28],
        ])}
        <rect
          x={17}
          y={17}
          width={62}
          height={27}
          rx={4}
          fill="#34465e"
          stroke={INK}
          strokeWidth={1.3}
        />
        <circle cx={48} cy={28} r={11} fill="#111b28" stroke="#617a95" strokeWidth={1.4} />
        <circle cx={45} cy={24} r={3.2} fill="#ffffff" opacity={0.2} />
      </>
    )
  }
  if (type === 'potentiometer') {
    return (
      <>
        {leads([
          [10, 38, 10, 30],
          [86, 38, 86, 30],
          [48, 48, 48, 37],
        ])}
        <rect
          x={18}
          y={17}
          width={60}
          height={21}
          rx={4}
          fill="#2c5c8e"
          stroke={INK}
          strokeWidth={1.2}
        />
        <circle cx={48} cy={27} r={12} fill="#d4dce6" stroke={METAL_DARK} />
        <circle cx={48} cy={27} r={8} fill="#7f91a6" />
        <rect x={46} y={20} width={4} height={9} rx={1.5} fill="#eef4fa" />
      </>
    )
  }
  if (type === 'slide-switch') {
    return (
      <>
        {leads([
          [0, 26, 16, 26],
          [80, 26, 96, 26],
        ])}
        <rect
          x={16}
          y={19}
          width={64}
          height={15}
          rx={3}
          fill="#d9e0e8"
          stroke={INK}
          strokeWidth={1.2}
        />
        <rect x={34} y={16} width={28} height={21} rx={3} fill="#34465e" stroke={INK} />
        <rect x={48} y={19} width={11} height={15} rx={2} fill="#eef4fa" stroke={METAL_DARK} />
      </>
    )
  }
  if (type === 'dip-switch-4' || type === 'dip-switch-6') {
    const count = type === 'dip-switch-4' ? 4 : 6
    return (
      <>
        {Array.from({ length: count }, (_unused, index) => {
          const x = 23 + index * (50 / Math.max(1, count - 1))
          return (
            <g key={index}>
              <line x1={x} y1={12} x2={x} y2={19} stroke={METAL_DARK} strokeWidth={2} />
              <line x1={x} y1={43} x2={x} y2={36} stroke={METAL_DARK} strokeWidth={2} />
            </g>
          )
        })}
        <rect
          x={17}
          y={19}
          width={62}
          height={17}
          rx={3}
          fill="#b53a3a"
          stroke={INK}
          strokeWidth={1.2}
        />
        {Array.from({ length: count }, (_unused, index) => {
          const x = 23 + index * (50 / Math.max(1, count - 1))
          return (
            <rect
              key={index}
              x={x - 4}
              y={index % 2 === 0 ? 21 : 26}
              width={8}
              height={7}
              rx={1}
              fill="#f2c14e"
              stroke="#7b652e"
            />
          )
        })}
      </>
    )
  }
  if (type === 'ldr' || type === 'thermistor') {
    const thermistor = type === 'thermistor'
    return (
      <>
        {leads([
          [34, 48, 34, 36],
          [62, 48, 62, 36],
        ])}
        <circle
          cx={48}
          cy={27}
          r={15}
          fill={thermistor ? '#3a2f28' : '#f0dfaa'}
          stroke={INK}
          strokeWidth={1.3}
        />
        <circle cx={48} cy={27} r={10} fill={thermistor ? '#d9784a' : '#e8c96c'} />
        <path
          d="M39 27 L43 22 L47 27 L51 22 L55 27 L58 24"
          fill="none"
          stroke={thermistor ? '#f3d7a1' : '#7a6a43'}
          strokeWidth={1.5}
        />
      </>
    )
  }
  if (type === 'flex-sensor') {
    return (
      <>
        {leads([
          [8, 28, 21, 28],
          [88, 28, 75, 28],
        ])}
        <rect
          x={21}
          y={20}
          width={54}
          height={16}
          rx={8}
          fill="#232833"
          stroke={INK}
          strokeWidth={1.2}
        />
        <path d="M27 28 H69" stroke="#c8864a" strokeWidth={3} />
        <path
          d="M28 24 L34 24 L38 32 L42 24 L46 32 L50 24 L54 32 L58 24 L64 24"
          fill="none"
          stroke="#f0c75e"
          strokeWidth={1.1}
        />
      </>
    )
  }
  if (type === 'force-sensor') {
    return (
      <>
        {leads([
          [34, 48, 34, 37],
          [62, 48, 62, 37],
        ])}
        <rect
          x={23}
          y={12}
          width={50}
          height={28}
          rx={5}
          fill="#2b3d54"
          stroke={INK}
          strokeWidth={1.2}
        />
        <circle cx={48} cy={26} r={11} fill="#455a72" stroke="#d6dce7" strokeWidth={1.2} />
        <circle cx={48} cy={26} r={4} fill="#111b28" />
      </>
    )
  }
  if (type === 'photodiode' || type === 'phototransistor') {
    const transistor = type === 'phototransistor'
    if (!transistor) {
      return (
        <>
          {leads([
            [0, 28, 26, 28],
            [70, 28, 96, 28],
          ])}
          <rect
            x={26}
            y={20}
            width={44}
            height={16}
            rx={8}
            fill="#232833"
            stroke={INK}
            strokeWidth={1.2}
          />
          <circle cx={48} cy={28} r={5.5} fill="#8fa3b8" stroke="#c9d0da" strokeWidth={1} />
          <path
            d="M60 18 L66 12 M66 22 L72 17"
            stroke="#f0c75e"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </>
      )
    }
    return (
      <>
        {leads([
          [30, 48, 30, 38],
          [66, 48, 66, 38],
        ])}
        <circle cx={48} cy={27} r={14} fill="#8a93a6" stroke={INK} strokeWidth={1.3} />
        <path
          d="M40 23 H40 V33 H49 V23 M49 29 L57 21"
          fill="none"
          stroke="#1d3045"
          strokeWidth={1.8}
        />
        <path
          d="M65 13 L70 7 M71 17 L77 12 M74 24 L81 23"
          stroke="#ffc928"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </>
    )
  }
  if (type === 'tilt-sensor') {
    return (
      <>
        {leads([
          [34, 48, 34, 37],
          [62, 48, 62, 37],
        ])}
        <rect
          x={26}
          y={12}
          width={44}
          height={27}
          rx={13}
          fill="#35485f"
          stroke={INK}
          strokeWidth={1.2}
        />
        <circle cx={38} cy={22} r={5} fill={METAL} />
        <path d="M35 33 L61 15" stroke="#8fa6bd" strokeWidth={1.2} />
      </>
    )
  }
  if (type === 'soil-moisture') {
    return (
      <>
        <rect
          x={24}
          y={12}
          width={48}
          height={30}
          rx={3}
          fill="#225c3d"
          stroke={INK}
          strokeWidth={1.2}
        />
        <rect x={30} y={7} width={36} height={7} rx={1} fill="#101820" stroke={INK} />
        {[34, 44, 54].map((x) => (
          <rect
            key={x}
            x={x}
            y={7}
            width={4}
            height={7}
            fill="#d6ad45"
            stroke="#8f7026"
            strokeWidth={0.5}
          />
        ))}
        <line x1={37} y1={42} x2={37} y2={52} stroke={METAL} strokeWidth={3.2} />
        <line x1={59} y1={42} x2={59} y2={52} stroke={METAL} strokeWidth={3.2} />
        <circle cx={36} cy={22} r={3} fill="#6fd3ff" />
        <circle cx={46} cy={19} r={2.2} fill="#6fd3ff" />
        <circle cx={54} cy={26} r={2.6} fill="#6fd3ff" />
        <text x={38} y={35} fontSize={4.5} fill="#e6f5ea" fontFamily="monospace">
          SOIL
        </text>
      </>
    )
  }
  if (type === 'gas-sensor') {
    return (
      <>
        {[
          [30, 10],
          [66, 10],
          [28, 22],
          [28, 36],
          [68, 22],
          [68, 36],
        ].map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={2.2} fill={METAL} stroke={METAL_DARK} />
        ))}
        <circle cx={48} cy={29} r={18} fill="#455a72" stroke={INK} strokeWidth={1.2} />
        {[0, 30, 60, 90, 120, 150].map((angle) => (
          <line
            key={angle}
            x1={48}
            y1={12}
            x2={48}
            y2={46}
            stroke="#7d8798"
            strokeWidth={0.8}
            transform={`rotate(${angle} 48 29)`}
          />
        ))}
        <circle cx={48} cy={29} r={6} fill="#d9784a" />
        <text x={42} y={48} fontSize={4} fill="#dce6f4" fontFamily="monospace">
          GAS
        </text>
      </>
    )
  }
  if (type === 'tmp36') {
    return (
      <>
        {leads([
          [35, 48, 35, 38],
          [48, 48, 48, 38],
          [61, 48, 61, 38],
        ])}
        <path
          d="M34 13 Q34 9 38 9 H58 Q62 9 62 13 V34 Q62 38 58 38 H38 Q34 38 34 34 Z"
          fill="#263a52"
          stroke={INK}
          strokeWidth={1.2}
        />
        <rect x={41} y={15} width={14} height={11} rx={1} fill="#111b28" />
        <text x={42} y={23} fontSize={5} fill="#dce8f3" fontFamily="monospace">
          TMP36
        </text>
      </>
    )
  }
  if (type === 'ir-receiver') return <IrReceiverPreview />
  if (type === 'ultrasonic-3pin') return <UltrasonicPreview threePin />
  if (type === 'ultrasonic-hcsr04') return <UltrasonicPreview />
  if (type === 'pir-sensor') return <PirPreview />
  if (type === 'keypad-4x4') return <KeypadPreview />
  if (type === 'ir-remote') return <IrRemotePreview />
  return <ModulePreview />
}

function OutputPreview({ type }: { readonly type: PartType }): JSX.Element {
  if (type === 'led' || type === 'rgb-led') return <LedPreview type={type} />
  if (type === 'seven-segment') {
    return (
      <>
        <rect
          x={27}
          y={5}
          width={46}
          height={46}
          rx={4}
          fill="#151c27"
          stroke={INK}
          strokeWidth={1.3}
        />
        {[
          'M35 13 H65',
          'M68 17 V28',
          'M68 31 V42',
          'M35 46 H65',
          'M30 31 V42',
          'M30 17 V28',
          'M35 29 H65',
        ].map((path) => (
          <path key={path} d={path} stroke="#ff5e57" strokeWidth={4} strokeLinecap="round" />
        ))}
        <circle cx={69} cy={47} r={2.4} fill="#ff5e57" />
        {Array.from({ length: 5 }, (_unused, index) => {
          const x = 31 + index * 9.5
          return (
            <g key={x}>
              <line x1={x} y1={1} x2={x} y2={5} stroke={METAL} strokeWidth={1.4} />
              <line x1={x} y1={51} x2={x} y2={55} stroke={METAL} strokeWidth={1.4} />
            </g>
          )
        })}
      </>
    )
  }
  if (type === 'buzzer') {
    return (
      <>
        {leads([
          [37, 48, 37, 39],
          [59, 48, 59, 39],
        ])}
        <circle cx={48} cy={26} r={19} fill="#1a2432" stroke={INK} strokeWidth={1.3} />
        <circle cx={48} cy={26} r={14} fill="#2c3e54" />
        <circle cx={48} cy={26} r={5} fill="#070d15" />
        <circle cx={43} cy={20} r={3} fill="#ffffff" opacity={0.12} />
      </>
    )
  }
  if (type === 'light-bulb') {
    return (
      <>
        {leads([
          [38, 48, 38, 38],
          [58, 48, 58, 38],
        ])}
        <circle
          cx={48}
          cy={24}
          r={15}
          fill="#ffe9a8"
          opacity={0.42}
          stroke={INK}
          strokeWidth={1.2}
        />
        <path
          d="M40 30 L44 20 L48 28 L52 18 L56 30"
          fill="none"
          stroke="#ffb300"
          strokeWidth={1.5}
        />
        <rect x={40} y={35} width={16} height={6} rx={1.5} fill={METAL} stroke={METAL_DARK} />
      </>
    )
  }
  if (type === 'dc-motor' || type === 'vibration-motor' || type === 'gear-motor') {
    const gear = type === 'gear-motor'
    const vibration = type === 'vibration-motor'
    return (
      <>
        {leads([
          [22, 48, 22, 40],
          [42, 48, 42, 40],
        ])}
        <rect
          x={13}
          y={14}
          width={46}
          height={27}
          rx={7}
          fill="#3a4d64"
          stroke={INK}
          strokeWidth={1.2}
        />
        <circle cx={36} cy={27} r={9} fill={METAL} stroke={METAL_DARK} />
        {gear ? (
          <g>
            <circle cx={64} cy={27} r={12} fill={METAL_DARK} stroke={INK} />
            {[0, 45, 90, 135].map((angle) => (
              <line
                key={angle}
                x1={64}
                y1={15}
                x2={64}
                y2={39}
                stroke="#99a8ba"
                strokeWidth={2}
                transform={`rotate(${angle} 64 27)`}
              />
            ))}
            <circle cx={64} cy={27} r={4} fill="#263a52" />
          </g>
        ) : vibration ? (
          <circle cx={62} cy={27} r={5} fill={METAL_DARK} stroke={INK} />
        ) : (
          <line
            x1={45}
            y1={27}
            x2={65}
            y2={27}
            stroke={METAL}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        )}
        <rect x={18} y={19} width={12} height={2} rx={1} fill="#ffffff" opacity={0.14} />
      </>
    )
  }
  if (type === 'neopixel-strip') {
    return (
      <>
        <rect
          x={8}
          y={20}
          width={80}
          height={17}
          rx={4}
          fill="#182330"
          stroke={INK}
          strokeWidth={1.2}
        />
        {Array.from({ length: 8 }, (_unused, index) => (
          <g key={index}>
            <circle
              cx={16 + index * 9.2}
              cy={28.5}
              r={3.8}
              fill={index % 3 === 0 ? '#ff5e57' : index % 3 === 1 ? '#46a758' : '#3b82f6'}
            />
            <circle cx={16 + index * 9.2} cy={28.5} r={1.4} fill="#ffffff" opacity={0.55} />
          </g>
        ))}
      </>
    )
  }
  if (type === 'neopixel-ring') {
    return (
      <>
        <circle cx={48} cy={28} r={22} fill="#182330" stroke={INK} strokeWidth={1.3} />
        {Array.from({ length: 12 }, (_unused, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2
          return (
            <circle
              key={index}
              cx={48 + Math.cos(angle) * 15}
              cy={28 + Math.sin(angle) * 15}
              r={3}
              fill={index % 3 === 0 ? '#ff5e57' : index % 3 === 1 ? '#46a758' : '#3b82f6'}
            />
          )
        })}
        <circle cx={48} cy={28} r={7} fill="#07121f" />
      </>
    )
  }
  if (type === 'lcd-16x2') return <LcdPreview />
  if (type === 'lcd-16x2-i2c') return <LcdPreview i2c />
  if (type === 'seven-segment-clock') return <SevenSegmentClockPreview />
  if (type === 'servo') return <ServoPreview />
  if (type === 'encoder-motor') return <EncoderMotorPreview />
  if (type === 'relay-spdt') return <RelayPreview />
  if (type === 'relay-dpdt') return <RelayPreview dpdt />
  return <ModulePreview />
}

const CHIP_PREVIEWS: Partial<Record<PartType, { readonly label: string; readonly pins: number }>> =
  {
    attiny85: { label: 'ATtiny85', pins: 8 },
    'ic-555': { label: '555', pins: 8 },
    'ic-556': { label: '556', pins: 14 },
    'opamp-741': { label: '741', pins: 8 },
    'comparator-lm393': { label: 'LM393', pins: 8 },
    'comparator-lm339': { label: 'LM339', pins: 14 },
    'optocoupler-4n35': { label: '4N35', pins: 6 },
    l293d: { label: 'L293D', pins: 16 },
    '74hc00': { label: '74HC00', pins: 14 },
    '74hc02': { label: '74HC02', pins: 14 },
    '74hc08': { label: '74HC08', pins: 14 },
    '74hc32': { label: '74HC32', pins: 14 },
    '74hc86': { label: '74HC86', pins: 14 },
    '74hc04': { label: '74HC04', pins: 14 },
    '74hc14': { label: '74HC14', pins: 14 },
    '74hc131': { label: '74HC131', pins: 14 },
    '74hc132': { label: '74HC132', pins: 14 },
    '74hc10': { label: '74HC10', pins: 14 },
    '74hc11': { label: '74HC11', pins: 14 },
    '74hc27': { label: '74HC27', pins: 14 },
    '74hc20': { label: '74HC20', pins: 14 },
    '74hc21': { label: '74HC21', pins: 14 },
    '74hc73': { label: '74HC73', pins: 14 },
    '74hc74': { label: '74HC74', pins: 14 },
    '74hc75': { label: '74HC75', pins: 16 },
    '74hc93': { label: '74HC93', pins: 14 },
    '74hc283': { label: '74HC283', pins: 16 },
    '74hc595': { label: '74HC595', pins: 16 },
    '74hc4017': { label: '74HC4017', pins: 16 },
    cd4511: { label: 'CD4511', pins: 16 },
  }

function ModulePreview(): JSX.Element {
  return (
    <>
      <rect
        x={13}
        y={8}
        width={70}
        height={39}
        rx={3}
        fill="#1a3d5c"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={22} y={16} width={27} height={19} rx={2} fill="#101a25" stroke="#3f5268" />
      <text
        x={35.5}
        y={27}
        textAnchor="middle"
        fontSize={4.4}
        fill="#9fb9d2"
        fontFamily="monospace"
      >
        MODULE
      </text>
      <rect x={57} y={17} width={18} height={6} rx={1} fill="#c7d4e2" />
      <rect x={57} y={27} width={18} height={6} rx={1} fill="#c7d4e2" />
      {[24, 36, 48, 60].map((x) => (
        <line key={x} x1={x} y1={47} x2={x} y2={53} stroke={METAL} strokeWidth={1.6} />
      ))}
    </>
  )
}

function BoardPreview({ type }: { readonly type: PartType }): JSX.Element {
  if (type === 'arduino-uno') return <ArduinoPreview />
  if (type === 'raspberry-pi') return <RaspberryPiPreview />
  if (type === 'breadboard') return <BreadboardPreview />
  if (type === 'breadboard-small') return <BreadboardPreview variant="small" />
  if (type === 'breadboard-mini') return <BreadboardPreview variant="mini" />
  if (type === 'microbit') return <MicrobitPreview />
  if (type === 'function-generator' || type === 'oscilloscope') {
    return <InstrumentPreview type={type} />
  }
  if (type === 'header-8') return <HeaderPreview />
  if (type === 'usb-a') return <UsbPreview />
  const chip = CHIP_PREVIEWS[type]
  if (chip !== undefined) return <ChipPreview label={chip.label} pins={chip.pins} />
  if (type === 'battery-aa' || type === 'battery-9v' || type === 'coin-cell') {
    return <BatteryPreview type={type} />
  }
  if (type === 'power-supply') {
    return (
      <>
        <rect
          x={15}
          y={14}
          width={66}
          height={32}
          rx={5}
          fill="#263a52"
          stroke={INK}
          strokeWidth={1.3}
        />
        <circle cx={29} cy={9} r={3.2} fill="#ff5e57" stroke={INK} />
        <circle cx={67} cy={9} r={3.2} fill="#111b28" stroke={INK} />
        <rect x={25} y={23} width={25} height={13} rx={2} fill="#8fd8ff" opacity={0.8} />
        <text x={29} y={33} fontSize={8} fill="#0b2b43" fontWeight="700" fontFamily="monospace">
          5.0V
        </text>
        <circle cx={67} cy={30} r={6} fill="#111b28" stroke={METAL_DARK} />
        <rect x={62} y={27} width={10} height={2} fill={METAL} />
      </>
    )
  }
  if (type === 'solar-cell') {
    return (
      <>
        <rect
          x={12}
          y={13}
          width={72}
          height={30}
          rx={3}
          fill="#17365c"
          stroke={INK}
          strokeWidth={1.2}
        />
        {Array.from({ length: 3 }, (_unused, row) =>
          Array.from({ length: 3 }, (_unusedColumn, column) => (
            <rect
              key={`${row}-${column}`}
              x={18 + column * 22}
              y={17 + row * 8}
              width={20}
              height={6}
              fill="#3f7fc4"
              stroke="#8ab6e8"
              strokeWidth={0.6}
            />
          ))
        )}
        <line x1={10} y1={28} x2={86} y2={28} stroke={METAL} strokeWidth={1.2} />
      </>
    )
  }
  if (type === 'potato-battery') {
    return (
      <>
        <ellipse cx={48} cy={31} rx={30} ry={19} fill="#9c7a4b" stroke={INK} strokeWidth={1.3} />
        <ellipse cx={39} cy={24} rx={10} ry={5} fill="#b8945f" opacity={0.7} />
        <line
          x1={34}
          y1={27}
          x2={34}
          y2={9}
          stroke={METAL}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <line
          x1={62}
          y1={27}
          x2={62}
          y2={9}
          stroke="#d9784a"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <text x={40} y={39} fontSize={6} fill="#f6ead2" fontWeight="700">
          0.9V
        </text>
      </>
    )
  }
  if (type === 'lm7805' || type === 'ld1117v33') {
    return (
      <>
        {leads([
          [22, 49, 22, 39],
          [48, 49, 48, 39],
          [74, 49, 74, 39],
        ])}
        <rect
          x={23}
          y={12}
          width={50}
          height={27}
          rx={3}
          fill="#263a52"
          stroke={INK}
          strokeWidth={1.2}
        />
        <rect x={39} y={7} width={18} height={7} rx={1.5} fill={METAL} stroke={METAL_DARK} />
        <text x={31} y={24} fontSize={7} fill="#eef4fa" fontFamily="monospace">
          {type === 'lm7805' ? '7805' : '1117'}
        </text>
        <text x={37} y={33} fontSize={6} fill="#9fd0ff" fontFamily="monospace">
          {type === 'lm7805' ? '5.0V' : '3.3V'}
        </text>
      </>
    )
  }
  if (type === 'multimeter') {
    return (
      <>
        <rect
          x={19}
          y={8}
          width={58}
          height={40}
          rx={5}
          fill="#e6b84a"
          stroke={INK}
          strokeWidth={1.3}
        />
        <rect x={26} y={13} width={44} height={12} rx={1.5} fill="#b6c2a1" stroke="#65705a" />
        <text x={31} y={22} fontSize={8} fill="#1e2b1e" fontWeight="700" fontFamily="monospace">
          12.34
        </text>
        <circle cx={48} cy={36} r={8} fill="#2b3038" stroke="#151920" />
        <line
          x1={48}
          y1={36}
          x2={48}
          y2={30}
          stroke="#f8fafc"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </>
    )
  }
  return (
    <>
      <rect
        x={10}
        y={15}
        width={76}
        height={28}
        rx={4}
        fill="#263a52"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={18} y={21} width={28} height={15} rx={1.5} fill="#b9d1ae" stroke="#536451" />
      <path d="M23 31 L28 25 L32 31 L37 24 L42 31" fill="none" stroke="#1d4e2c" strokeWidth={1.1} />
      <circle cx={64} cy={27} r={5} fill="#111b28" stroke={METAL_DARK} />
      <circle cx={78} cy={27} r={5} fill="#111b28" stroke={METAL_DARK} />
    </>
  )
}

function ChipPreview({
  label,
  pins = 14,
}: {
  readonly label: string
  readonly pins?: number
}): JSX.Element {
  const legs = Math.ceil(pins / 2)
  return (
    <>
      {Array.from({ length: legs }, (_unused, index) => {
        const y = 13 + (index * 30) / Math.max(1, legs - 1)
        return (
          <g key={index}>
            <line x1={16} y1={y} x2={22} y2={y} stroke={METAL} strokeWidth={1.8} />
            <line x1={74} y1={y} x2={80} y2={y} stroke={METAL} strokeWidth={1.8} />
          </g>
        )
      })}
      <rect
        x={22}
        y={7}
        width={52}
        height={42}
        rx={3}
        fill="#111a25"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={22} y={7} width={52} height={5} rx={2.5} fill="#ffffff" opacity={0.07} />
      <path d="M40 7 A8 8 0 0 0 56 7" fill="#081018" />
      <circle cx={30} cy={15} r={1.3} fill="#34475d" />
      <text
        x={48}
        y={32}
        textAnchor="middle"
        fontSize={label.length > 6 ? 6.2 : 7.2}
        fill="#dce9f7"
        fontWeight="700"
        fontFamily="monospace"
      >
        {label}
      </text>
      <text x={48} y={41} textAnchor="middle" fontSize={3.8} fill="#6f8ba8" fontFamily="monospace">
        {pins} PIN DIP
      </text>
    </>
  )
}

function MicrobitPreview(): JSX.Element {
  return (
    <>
      <rect
        x={13}
        y={5}
        width={70}
        height={46}
        rx={4}
        fill="#14191f"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={33} y={10} width={30} height={30} rx={2} fill="#080d12" />
      {Array.from({ length: 25 }, (_unused, index) => (
        <circle
          key={index}
          cx={37 + (index % 5) * 5.6}
          cy={14 + Math.floor(index / 5) * 5.6}
          r={1.7}
          fill={index % 4 === 0 ? '#ff5e57' : '#8ea4b9'}
        />
      ))}
      {Array.from({ length: 5 }, (_unused, index) => (
        <rect
          key={index}
          x={14 + index * 14}
          y={45}
          width={9}
          height={7}
          rx={1}
          fill="#d3ad52"
          stroke="#6e5722"
          strokeWidth={0.7}
        />
      ))}
      <circle cx={22} cy={38} r={2} fill="#3b82f6" />
    </>
  )
}

function LcdPreview({ i2c = false }: { readonly i2c?: boolean }): JSX.Element {
  return (
    <>
      {i2c && (
        <rect
          x={9}
          y={15}
          width={78}
          height={31}
          rx={3}
          fill="#1d5b45"
          stroke={INK}
          strokeWidth={1.1}
        />
      )}
      <rect
        x={14}
        y={6}
        width={68}
        height={42}
        rx={3}
        fill="#2a4b3d"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={19} y={10} width={58} height={30} rx={2} fill="#9acb72" stroke="#4b7237" />
      {Array.from({ length: 2 }, (_unused, row) =>
        Array.from({ length: 16 }, (_unusedColumn, column) => (
          <rect
            key={`${row}-${column}`}
            x={22 + column * 3.35}
            y={16 + row * 10}
            width={2.1}
            height={5.5}
            rx={0.5}
            fill="#1d3c2a"
            opacity={0.72}
          />
        ))
      )}
      {i2c ? (
        <>
          <circle cx={17} cy={21} r={2.4} fill="#c7d4e2" stroke={INK} strokeWidth={0.6} />
          <rect x={37} y={41} width={22} height={9} rx={1.5} fill="#1b2a3a" />
          {[0, 1, 2, 3].map((index) => (
            <line
              key={index}
              x1={41 + index * 5}
              y1={47}
              x2={41 + index * 5}
              y2={53}
              stroke={METAL}
              strokeWidth={1.6}
            />
          ))}
        </>
      ) : (
        Array.from({ length: 16 }, (_unused, index) => (
          <line
            key={index}
            x1={17 + index * 4}
            y1={48}
            x2={17 + index * 4}
            y2={54}
            stroke={METAL}
            strokeWidth={1.1}
          />
        ))
      )}
    </>
  )
}

function SevenSegmentClockPreview(): JSX.Element {
  const digits = [1, 2, 3, 4]
  return (
    <>
      <rect
        x={7}
        y={7}
        width={82}
        height={42}
        rx={4}
        fill="#151c27"
        stroke={INK}
        strokeWidth={1.2}
      />
      {digits.map((digit, index) => {
        const x = 13 + index * 19
        const y = 13
        return (
          <g key={digit} transform={`translate(${x} ${y})`}>
            {[
              'M3 2 H15',
              'M17 4 V12',
              'M17 16 V24',
              'M3 26 H15',
              'M1 16 V24',
              'M1 4 V12',
              'M3 14 H15',
            ].map((path, segment) => (
              <path
                key={segment}
                d={path}
                stroke="#ff5e57"
                strokeWidth={2.6}
                strokeLinecap="round"
                opacity={
                  segment === 0 || segment === 1 || segment === 3 || segment === 6 ? 0.95 : 0.18
                }
              />
            ))}
          </g>
        )
      })}
      <text x={48} y={46} textAnchor="middle" fontSize={4} fill="#7d94ad" fontFamily="monospace">
        4-DIGIT CLOCK
      </text>
      {[24, 40, 56, 72].map((x) => (
        <line key={x} x1={x} y1={49} x2={x} y2={55} stroke={METAL} strokeWidth={1.5} />
      ))}
    </>
  )
}

function UltrasonicPreview({ threePin = false }: { readonly threePin?: boolean }): JSX.Element {
  return (
    <>
      <rect
        x={11}
        y={10}
        width={74}
        height={33}
        rx={3}
        fill="#173f6a"
        stroke={INK}
        strokeWidth={1.2}
      />
      {[32, 64].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={26} r={12} fill="#b9c7d6" stroke="#60758c" strokeWidth={1.2} />
          <circle cx={cx} cy={26} r={8.5} fill="#8fa3b8" stroke="#52677d" />
          {Array.from({ length: 5 }, (_unused, index) => (
            <circle
              key={index}
              cx={cx}
              cy={26}
              r={2 + index * 1.3}
              fill="none"
              stroke="#596e84"
              strokeWidth={0.55}
            />
          ))}
        </g>
      ))}
      <text x={48} y={15} textAnchor="middle" fontSize={4.2} fill="#93c4f2" fontFamily="monospace">
        {threePin ? 'HC-SR04 3-PIN' : 'HC-SR04'}
      </text>
      {Array.from({ length: threePin ? 3 : 4 }, (_unused, index) => (
        <line
          key={index}
          x1={24 + index * (threePin ? 16 : 13)}
          y1={43}
          x2={24 + index * (threePin ? 16 : 13)}
          y2={52}
          stroke={METAL}
          strokeWidth={1.8}
        />
      ))}
    </>
  )
}

function PirPreview(): JSX.Element {
  return (
    <>
      <rect
        x={17}
        y={25}
        width={62}
        height={19}
        rx={3}
        fill="#1c5b48"
        stroke={INK}
        strokeWidth={1.2}
      />
      <circle cx={48} cy={22} r={17} fill="#e8edf2" stroke="#7c8b9c" strokeWidth={1.2} />
      {[7, 11, 15].map((radius) => (
        <path
          key={radius}
          d={`M${48 - radius} 22 A${radius} ${radius} 0 0 0 ${48 + radius} 22`}
          fill="none"
          stroke="#b3c0cc"
          strokeWidth={0.8}
        />
      ))}
      <circle cx={48} cy={20} r={3.2} fill="#d6dee7" stroke="#8d9baa" strokeWidth={0.7} />
      {[32, 48, 64].map((x) => (
        <line key={x} x1={x} y1={44} x2={x} y2={52} stroke={METAL} strokeWidth={1.7} />
      ))}
    </>
  )
}

function KeypadPreview(): JSX.Element {
  return (
    <>
      <rect
        x={16}
        y={3}
        width={64}
        height={50}
        rx={3}
        fill="#101923"
        stroke={INK}
        strokeWidth={1.2}
      />
      {[28, 44, 60, 76].map((x) => (
        <g key={x}>
          <line x1={x} y1={0} x2={x} y2={3} stroke={METAL} strokeWidth={1.6} />
          <line x1={x} y1={53} x2={x} y2={56} stroke={METAL} strokeWidth={1.6} />
        </g>
      ))}
      <rect x={24} y={9} width={48} height={36} rx={1.5} fill="#dfe7ef" />
      {Array.from({ length: 16 }, (_unused, index) => {
        const column = index % 4
        const row = Math.floor(index / 4)
        return (
          <g key={index}>
            <rect
              x={26 + column * 11.5}
              y={11 + row * 8.5}
              width={9.5}
              height={6.5}
              rx={1}
              fill={row === 3 && column === 3 ? '#ff5e57' : '#f8fafc'}
              stroke="#9aa9b8"
              strokeWidth={0.6}
            />
            <text
              x={30.7 + column * 11.5}
              y={15.8 + row * 8.5}
              textAnchor="middle"
              fontSize={3.4}
              fill="#233246"
              fontFamily="monospace"
            >
              {
                ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'][
                  index
                ]
              }
            </text>
          </g>
        )
      })}
    </>
  )
}

function IrReceiverPreview(): JSX.Element {
  return (
    <>
      <rect
        x={28}
        y={18}
        width={40}
        height={28}
        rx={3}
        fill="#183c63"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect
        x={38}
        y={8}
        width={20}
        height={21}
        rx={3}
        fill="#121a23"
        stroke={INK}
        strokeWidth={1.1}
      />
      <circle cx={48} cy={18} r={6} fill="#293544" stroke="#526579" />
      <circle cx={45} cy={16} r={1.7} fill="#ffffff" opacity={0.2} />
      {[36, 48, 60].map((x) => (
        <line key={x} x1={x} y1={46} x2={x} y2={53} stroke={METAL} strokeWidth={1.6} />
      ))}
    </>
  )
}

function IrRemotePreview(): JSX.Element {
  return (
    <>
      <rect
        x={29}
        y={3}
        width={38}
        height={50}
        rx={6}
        fill="#161d27"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={32} y={6} width={32} height={5} rx={2.5} fill="#ffffff" opacity={0.06} />
      <circle cx={48} cy={16} r={5.5} fill="#c83b3b" stroke="#762323" />
      <text x={48} y={17.5} textAnchor="middle" fontSize={4} fill="#ffe5e5" fontFamily="monospace">
        PWR
      </text>
      {Array.from({ length: 12 }, (_unused, index) => {
        const column = index % 3
        const row = Math.floor(index / 3)
        return (
          <rect
            key={index}
            x={35 + column * 9.5}
            y={25 + row * 6.8}
            width={7}
            height={4.5}
            rx={1.6}
            fill="#46566a"
            stroke="#273342"
            strokeWidth={0.5}
          />
        )
      })}
    </>
  )
}

function ServoPreview(): JSX.Element {
  return (
    <>
      <path d="M24 12 H52 V18 H24 Z" fill="#2d6db5" stroke={INK} strokeWidth={1.1} />
      <rect
        x={19}
        y={18}
        width={48}
        height={26}
        rx={3}
        fill="#2d6db5"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={24} y={22} width={9} height={17} rx={1.5} fill="#dbe5ee" stroke="#8fa0b3" />
      <rect x={51} y={22} width={10} height={17} rx={1.5} fill="#dbe5ee" stroke="#8fa0b3" />
      <circle cx={67} cy={26} r={10} fill="#eef3f8" stroke="#8fa0b3" />
      <circle cx={67} cy={26} r={3} fill="#2d6db5" />
      <path d="M67 16 L76 11" stroke="#eef3f8" strokeWidth={4} strokeLinecap="round" />
      {[
        ['#b77b3b', 27],
        ['#d33a3a', 36],
        ['#424242', 45],
      ].map(([color, x]) => (
        <line
          key={String(x)}
          x1={Number(x)}
          y1={44}
          x2={Number(x)}
          y2={53}
          stroke={String(color)}
          strokeWidth={1.6}
        />
      ))}
    </>
  )
}

function RelayPreview({ dpdt = false }: { readonly dpdt?: boolean }): JSX.Element {
  return (
    <>
      {leads([
        [30, 8, 30, 13],
        [66, 8, 66, 13],
      ])}
      <rect
        x={17}
        y={13}
        width={62}
        height={30}
        rx={3}
        fill="#215f9a"
        stroke={INK}
        strokeWidth={1.2}
      />
      <rect x={21} y={15} width={54} height={11} rx={1.5} fill="#dce7f1" stroke="#8fa4b9" />
      <text x={48} y={23} textAnchor="middle" fontSize={5.5} fill="#1c2b3d" fontWeight="700">
        {dpdt ? 'DPDT RELAY' : 'SPDT RELAY'}
      </text>
      <text x={48} y={36} textAnchor="middle" fontSize={4.5} fill="#bcd9f2" fontFamily="monospace">
        {dpdt ? '8 PIN' : '5 PIN'}
      </text>
      {Array.from({ length: dpdt ? 6 : 3 }, (_unused, index) => {
        const count = dpdt ? 6 : 3
        const x = 24 + index * (48 / (count - 1))
        return <line key={x} x1={x} y1={43} x2={x} y2={52} stroke={METAL} strokeWidth={1.7} />
      })}
    </>
  )
}

function EncoderMotorPreview(): JSX.Element {
  return (
    <>
      <rect
        x={12}
        y={15}
        width={43}
        height={26}
        rx={5}
        fill="#354960"
        stroke={INK}
        strokeWidth={1.2}
      />
      <circle cx={33} cy={28} r={9} fill={METAL} stroke={METAL_DARK} />
      <circle cx={33} cy={28} r={3} fill="#34475d" />
      <circle cx={67} cy={28} r={13} fill="#1a2635" stroke={METAL_DARK} strokeWidth={1.2} />
      {Array.from({ length: 8 }, (_unused, index) => {
        const angle = (index / 8) * Math.PI * 2
        return (
          <line
            key={index}
            x1={67 + Math.cos(angle) * 6}
            y1={28 + Math.sin(angle) * 6}
            x2={67 + Math.cos(angle) * 11}
            y2={28 + Math.sin(angle) * 11}
            stroke="#8ea4bb"
            strokeWidth={1.4}
          />
        )
      })}
      {leads([
        [20, 9, 20, 15],
        [30, 9, 30, 15],
        [40, 9, 40, 15],
        [22, 41, 22, 53],
        [32, 41, 32, 53],
        [80, 28, 86, 28],
      ])}
    </>
  )
}

function HeaderPreview(): JSX.Element {
  return (
    <>
      <rect
        x={11}
        y={22}
        width={74}
        height={12}
        rx={1.5}
        fill="#101820"
        stroke={INK}
        strokeWidth={1.1}
      />
      {Array.from({ length: 8 }, (_unused, index) => (
        <g key={index}>
          <rect
            x={14 + index * 9}
            y={10}
            width={3}
            height={34}
            rx={0.8}
            fill="#d6ad45"
            stroke="#8f7026"
          />
          <rect x={12 + index * 9} y={21} width={7} height={5} fill="#1b2530" />
        </g>
      ))}
    </>
  )
}

function UsbPreview(): JSX.Element {
  return (
    <>
      <rect
        x={18}
        y={16}
        width={60}
        height={24}
        rx={3}
        fill="#aebdcc"
        stroke="#5f7287"
        strokeWidth={1.2}
      />
      <rect x={18} y={16} width={60} height={5} rx={2.5} fill="#e6eef5" opacity={0.7} />
      <rect x={36} y={22} width={42} height={12} rx={1.5} fill="#1a2430" />
      <rect x={39} y={24} width={36} height={2} fill="#c9d8e6" />
      <rect x={39} y={28} width={36} height={2} fill="#c9d8e6" />
      <rect x={23} y={41} width={3} height={6} fill={METAL} />
      <rect x={70} y={41} width={3} height={6} fill={METAL} />
    </>
  )
}

function InstrumentPreview({ type }: { readonly type: PartType }): JSX.Element {
  const scope = type === 'oscilloscope'
  return (
    <>
      <rect
        x={8}
        y={7}
        width={80}
        height={42}
        rx={5}
        fill="#d8dde4"
        stroke="#7d8998"
        strokeWidth={1.2}
      />
      <rect
        x={13}
        y={12}
        width={scope ? 54 : 43}
        height={29}
        rx={2}
        fill="#173f42"
        stroke="#0c2426"
      />
      <path
        d={
          scope
            ? 'M16 27 H25 L30 16 L36 38 L42 21 L47 31 L53 24 L61 27'
            : 'M17 31 Q24 13 31 31 T45 31 T54 21'
        }
        fill="none"
        stroke="#8cf6a7"
        strokeWidth={1.4}
      />
      <text x={13} y={46} fontSize={3.8} fill="#4b5868" fontFamily="monospace">
        {scope ? 'OSCILLOSCOPE' : 'FUNCTION GEN'}
      </text>
      <circle cx={77} cy={20} r={5} fill="#293544" stroke="#101820" />
      <circle cx={77} cy={36} r={5} fill="#293544" stroke="#101820" />
      <line x1={77} y1={20} x2={77} y2={16} stroke="#f2f6fa" strokeWidth={1.2} />
      <line x1={77} y1={36} x2={80} y2={34} stroke="#f2f6fa" strokeWidth={1.2} />
    </>
  )
}

function TransistorPreview({ type }: { readonly type: PartType }): JSX.Element {
  const power = type === 'tip120'
  const mosfet = type === 'mosfet-n' || type === 'mosfet-p'
  const label = power
    ? 'TIP120'
    : mosfet
      ? type === 'mosfet-n'
        ? 'N-MOS'
        : 'P-MOS'
      : type === 'transistor-pnp'
        ? 'PNP'
        : 'NPN'
  if (power) {
    return (
      <>
        <rect x={30} y={10} width={36} height={8} rx={1} fill={METAL} stroke={METAL_DARK} />
        <rect
          x={28}
          y={16}
          width={40}
          height={26}
          rx={2}
          fill="#1a2431"
          stroke={INK}
          strokeWidth={1.2}
        />
        <text
          x={48}
          y={32}
          textAnchor="middle"
          fontSize={6}
          fill="#dbe7f3"
          fontWeight="700"
          fontFamily="monospace"
        >
          {label}
        </text>
        {[36, 48, 60].map((x) => (
          <line key={x} x1={x} y1={42} x2={x} y2={53} stroke={METAL} strokeWidth={2} />
        ))}
      </>
    )
  }
  return (
    <>
      <path
        d="M33 14 Q48 5 63 14 L63 34 Q48 43 33 34 Z"
        fill="#161f2b"
        stroke={INK}
        strokeWidth={1.2}
      />
      <text
        x={48}
        y={27}
        textAnchor="middle"
        fontSize={5.5}
        fill="#dbe7f3"
        fontWeight="700"
        fontFamily="monospace"
      >
        {label}
      </text>
      {[38, 48, 58].map((x) => (
        <line key={x} x1={x} y1={37} x2={x} y2={53} stroke={METAL} strokeWidth={1.8} />
      ))}
    </>
  )
}

function assertNever(value: never): never {
  throw new Error(`No preview artwork for ${String(value)}`)
}

function partArt(type: PartType): ReactNode {
  switch (type) {
    case 'arduino-uno':
    case 'raspberry-pi':
    case 'breadboard':
    case 'breadboard-small':
    case 'breadboard-mini':
    case 'battery-aa':
    case 'battery-9v':
    case 'coin-cell':
    case 'power-supply':
    case 'solar-cell':
    case 'potato-battery':
    case 'lm7805':
    case 'ld1117v33':
    case 'microbit':
    case 'attiny85':
    case 'multimeter':
    case 'function-generator':
    case 'oscilloscope':
    case 'ic-555':
    case 'ic-556':
    case 'opamp-741':
    case 'comparator-lm393':
    case 'comparator-lm339':
    case 'optocoupler-4n35':
    case 'l293d':
    case 'header-8':
    case 'usb-a':
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
      return <BoardPreview type={type} />
    case 'resistor':
    case 'capacitor':
    case 'electrolytic-capacitor':
    case 'inductor':
    case 'diode':
    case 'zener-diode':
      return <PassivePreview type={type} />
    case 'transistor-npn':
    case 'transistor-pnp':
    case 'tip120':
    case 'mosfet-n':
    case 'mosfet-p':
      return <TransistorPreview type={type} />
    case 'led':
    case 'rgb-led':
    case 'seven-segment':
    case 'buzzer':
    case 'light-bulb':
    case 'dc-motor':
    case 'vibration-motor':
    case 'gear-motor':
    case 'neopixel-strip':
    case 'neopixel-ring':
    case 'encoder-motor':
    case 'servo':
    case 'lcd-16x2':
    case 'lcd-16x2-i2c':
    case 'seven-segment-clock':
    case 'relay-spdt':
    case 'relay-dpdt':
      return <OutputPreview type={type} />
    case 'push-button':
    case 'potentiometer':
    case 'slide-switch':
    case 'ldr':
    case 'thermistor':
    case 'flex-sensor':
    case 'force-sensor':
    case 'photodiode':
    case 'phototransistor':
    case 'tilt-sensor':
    case 'soil-moisture':
    case 'gas-sensor':
    case 'tmp36':
    case 'dip-switch-4':
    case 'dip-switch-6':
    case 'ir-receiver':
    case 'ultrasonic-3pin':
    case 'ultrasonic-hcsr04':
    case 'pir-sensor':
    case 'keypad-4x4':
    case 'ir-remote':
      return <InputPreview type={type} />
    default:
      return assertNever(type)
  }
}

export function PartPreview({ type }: { readonly type: PartType }): JSX.Element {
  return (
    <span className="cb-part-thumb" aria-hidden="true">
      <svg className="cb-part-art" viewBox="0 0 96 56" focusable="false">
        {partArt(type)}
      </svg>
    </span>
  )
}
