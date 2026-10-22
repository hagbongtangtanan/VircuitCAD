import type { JSX, ReactNode } from 'react'

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
      <rect x={8} y={8} width={80} height={40} rx={4} fill={BOARD} stroke={INK} strokeWidth={1.3} />
      <rect x={8} y={8} width={80} height={5} rx={3} fill="#ffffff" opacity={0.12} />
      <rect x={16} y={11} width={17} height={20} rx={2} fill={METAL} stroke={METAL_DARK} />
      <rect x={63} y={11} width={19} height={11} rx={1.5} fill={METAL} stroke={METAL_DARK} />
      <rect x={63} y={27} width={19} height={11} rx={1.5} fill={METAL} stroke={METAL_DARK} />
      <rect x={42} y={17} width={16} height={20} rx={1.5} fill="#101c28" stroke="#071019" />
      <rect x={45} y={21} width={10} height={12} rx={1} fill="#1d3045" />
      <circle cx={84} cy={40} r={3.2} fill="#dce7f2" stroke={METAL_DARK} strokeWidth={0.8} />
      <circle cx={84} cy={23} r={2.4} fill="#e9f0f7" />
      <rect x={13} y={38} width={28} height={6} rx={2} fill="#082d3b" />
      <text x={20} y={43} fontSize={4.5} fill="#bce8f1" fontFamily="monospace">
        UNO R3
      </text>
    </>
  )
}

function BreadboardPreview(): JSX.Element {
  return (
    <>
      <rect x={8} y={9} width={80} height={38} rx={4} fill={CREAM} stroke={INK} strokeWidth={1.2} />
      <rect x={13} y={12} width={70} height={2.2} rx={1.1} fill="#d59b35" />
      <rect x={13} y={42} width={70} height={2.2} rx={1.1} fill="#d59b35" />
      <rect x={13} y={15.5} width={70} height={2.2} rx={1.1} fill="#3d7fc7" />
      <rect x={13} y={38.5} width={70} height={2.2} rx={1.1} fill="#3d7fc7" />
      {Array.from({ length: 14 }, (_unused, column) =>
        Array.from({ length: 6 }, (_unusedRow, row) => (
          <circle
            key={`${column}-${row}`}
            cx={14 + column * 5.2}
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

function PassivePreview({ type }: { readonly type: string }): JSX.Element {
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
  return (
    <>
      {leads([
        [34, 51, 34, 37],
        [46, 51, 46, 31],
        [58, 51, 58, 37],
      ])}
      <circle
        cx={48}
        cy={24}
        r={16}
        fill={rgb ? '#e7edf5' : '#e5484d'}
        stroke={INK}
        strokeWidth={1.4}
      />
      <circle cx={48} cy={24} r={11} fill={rgb ? '#f6f8fb' : '#ff7c81'} opacity={0.7} />
      {rgb ? (
        <>
          <circle cx={42} cy={25} r={3.2} fill="#e5484d" />
          <circle cx={48} cy={21} r={3.2} fill="#46a758" />
          <circle cx={54} cy={25} r={3.2} fill="#3b82f6" />
        </>
      ) : (
        <circle cx={44} cy={19} r={4} fill="#ffffff" opacity={0.55} />
      )}
      <path
        d="M62 31 L68 37 L73 36"
        fill="none"
        stroke={METAL_DARK}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path d="M33 38 L33 44" stroke={METAL_DARK} strokeWidth={2.2} />
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
      <text x={16} y={27} fontSize={7} fill="#f4d27a" fontWeight="700">
        +
      </text>
    </>
  )
}

function InputPreview({ type }: { readonly type: string }): JSX.Element {
  if (type === 'push-button') {
    return (
      <>
        {leads([
          [10, 42, 10, 30],
          [86, 42, 86, 30],
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
          [12, 39, 12, 31],
          [84, 39, 84, 31],
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
    return (
      <>
        {leads([
          [30, 48, 30, 38],
          [66, 48, 66, 38],
        ])}
        <circle
          cx={48}
          cy={27}
          r={14}
          fill={transistor ? '#8a93a6' : '#232833'}
          stroke={INK}
          strokeWidth={1.3}
        />
        {transistor ? (
          <>
            <path
              d="M40 23 H40 V33 H49 V23 M49 29 L57 21"
              fill="none"
              stroke="#1d3045"
              strokeWidth={1.8}
            />
          </>
        ) : (
          <path d="M56 19 V35 L48 31 M56 19 L63 23" fill="none" stroke={METAL} strokeWidth={1.4} />
        )}
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
          y={8}
          width={48}
          height={28}
          rx={3}
          fill="#225c3d"
          stroke={INK}
          strokeWidth={1.2}
        />
        <line x1={37} y1={36} x2={37} y2={51} stroke={METAL} strokeWidth={3.2} />
        <line x1={59} y1={36} x2={59} y2={51} stroke={METAL} strokeWidth={3.2} />
        <circle cx={36} cy={20} r={3} fill="#6fd3ff" />
        <circle cx={46} cy={17} r={2.2} fill="#6fd3ff" />
        <circle cx={54} cy={24} r={2.6} fill="#6fd3ff" />
      </>
    )
  }
  if (type === 'gas-sensor') {
    return (
      <>
        {Array.from({ length: 8 }, (_unused, index) => (
          <circle
            key={index}
            cx={[24, 68, 20, 72, 28, 64, 36, 56][index]}
            cy={[30, 30, 18, 18, 43, 43, 48, 48][index]}
            r={2}
            fill={METAL}
            stroke={METAL_DARK}
          />
        ))}
        <circle cx={48} cy={29} r={19} fill="#455a72" stroke={INK} strokeWidth={1.2} />
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
  return <BreadboardPreview />
}

function OutputPreview({ type }: { readonly type: string }): JSX.Element {
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
  return <BuzzerFallback />
}

function BuzzerFallback(): JSX.Element {
  return (
    <>
      <circle cx={48} cy={28} r={18} fill="#1a2432" stroke={INK} strokeWidth={1.2} />
      <circle cx={48} cy={28} r={5} fill="#070d15" />
    </>
  )
}

function BoardPreview({ type }: { readonly type: string }): JSX.Element {
  if (type === 'arduino-uno') return <ArduinoPreview />
  if (type === 'breadboard') return <BreadboardPreview />
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
          Array.from({ length: 4 }, (_unusedColumn, column) => (
            <rect
              key={`${row}-${column}`}
              x={16 + column * 16}
              y={17 + row * 8}
              width={14}
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

function partArt(type: string): ReactNode {
  if (
    [
      'arduino-uno',
      'breadboard',
      'battery-aa',
      'battery-9v',
      'coin-cell',
      'power-supply',
      'solar-cell',
      'potato-battery',
      'lm7805',
      'ld1117v33',
      'multimeter',
      'function-generator',
    ].includes(type)
  ) {
    return <BoardPreview type={type} />
  }
  if (
    [
      'resistor',
      'capacitor',
      'electrolytic-capacitor',
      'inductor',
      'diode',
      'zener-diode',
    ].includes(type)
  ) {
    return <PassivePreview type={type} />
  }
  if (
    [
      'led',
      'rgb-led',
      'seven-segment',
      'buzzer',
      'light-bulb',
      'dc-motor',
      'vibration-motor',
      'gear-motor',
      'neopixel-strip',
      'neopixel-ring',
    ].includes(type)
  ) {
    return <OutputPreview type={type} />
  }
  return <InputPreview type={type} />
}

export function PartPreview({ type }: { readonly type: string }): JSX.Element {
  return (
    <span className="cb-part-thumb" aria-hidden="true">
      <svg className="cb-part-art" viewBox="0 0 96 56" focusable="false">
        {partArt(type)}
      </svg>
    </span>
  )
}
