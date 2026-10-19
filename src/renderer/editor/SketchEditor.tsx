import { cpp } from '@codemirror/lang-cpp'
import CodeMirror from '@uiw/react-codemirror'
import type { JSX } from 'react'
import { useSketchStore } from '../store/sketchStore'

/** Arduino C++ editor. The sketch lives in the store, so the canvas and the
 * simulator see the same source. */
export function SketchEditor(): JSX.Element {
  const source = useSketchStore((state) => state.source)
  const setSource = useSketchStore((state) => state.setSource)

  return (
    <div className="sketch-editor" data-testid="sketch-editor">
      <CodeMirror
        value={source}
        height="100%"
        theme="dark"
        extensions={[cpp()]}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        onChange={(value) => setSource(value)}
      />
    </div>
  )
}
