import type { KonvaEventObject } from 'konva/lib/Node'
import type { JSX } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type { Note } from '../../shared/circuit'
import { useCircuitStore } from '../store/circuitStore'
import { snapPoint } from './geometry'
import { NOTE_FONT_SIZE, NOTE_LINE_HEIGHT, NOTE_PADDING, NOTE_WIDTH, noteHeight } from './notes'

interface NoteNodeProps {
  readonly note: Note
  readonly selected: boolean
  readonly routing: boolean
  readonly scale: number
}

/** A sticky note that lives in world space and is edited from the inspector. */
export function NoteNode({ note, selected, routing, scale }: NoteNodeProps): JSX.Element {
  const moveNote = useCircuitStore((state) => state.moveNote)
  const beginTransientEdit = useCircuitStore((state) => state.beginTransientEdit)
  const commitTransientEdit = useCircuitStore((state) => state.commitTransientEdit)
  const selectNote = useCircuitStore((state) => state.selectNote)
  const height = noteHeight(note.text)

  const select = (event: KonvaEventObject<MouseEvent>): void => {
    event.cancelBubble = true
    selectNote(note.id)
  }

  return (
    <Group
      x={note.position.x}
      y={note.position.y}
      name="circuit-note"
      draggable={!routing}
      onDragStart={() => {
        beginTransientEdit()
      }}
      onDragMove={(event) => {
        moveNote(note.id, { x: event.target.x(), y: event.target.y() })
      }}
      onDragEnd={(event) => {
        moveNote(note.id, snapPoint({ x: event.target.x(), y: event.target.y() }))
        commitTransientEdit()
      }}
      onMouseDown={(event) => {
        if (event.evt.button !== 0 || routing) return
        select(event)
      }}
      onClick={select}
      onDblClick={select}
    >
      <Rect
        width={NOTE_WIDTH}
        height={height}
        cornerRadius={8}
        fill="#ffe58a"
        stroke={selected ? '#ffc928' : '#d9a600'}
        strokeWidth={(selected ? 2.5 : 1) / scale}
        shadowColor="#000000"
        shadowOpacity={0.3}
        shadowBlur={12 / scale}
        shadowOffsetY={4 / scale}
      />
      <Rect width={5} height={height} cornerRadius={[8, 0, 0, 8]} fill="#e0a800" />
      <Text
        x={NOTE_PADDING}
        y={NOTE_PADDING}
        width={NOTE_WIDTH - NOTE_PADDING * 2}
        height={height - NOTE_PADDING * 2}
        text={note.text}
        fontFamily="system-ui, sans-serif"
        fontSize={NOTE_FONT_SIZE}
        lineHeight={NOTE_LINE_HEIGHT}
        fill="#2b2200"
        wrap="word"
        listening={false}
      />
    </Group>
  )
}
