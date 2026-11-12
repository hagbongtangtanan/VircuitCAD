import {
  DEFAULT_WIRE_COLOR,
  DocumentStore,
  createDefaultPartRegistry,
  createEmptyCircuit,
  defaultCapabilities,
  deserializeCircuit,
  extractNetlist,
  serializeCircuit,
  sketchOf,
  unavailableReason,
  type ParamValue,
  type PartInstance,
} from '@vircuitcad/core';
import {
  Editor,
  McuCircuit,
  RunController,
  SimulationHost,
  type PinHoverInfo,
  type RunState,
} from '@vircuitcad/editor';
import {
  AppShell,
  CanvasControls,
  CodeEditor,
  ICONS,
  Inspector,
  InstrumentPanel,
  PartsBin,
  ProblemsPanel,
  RunControls,
  SerialBuffer,
  SerialMonitor,
  StatusBar,
  Toast,
  Toolbar,
  WireColorPicker,
  type MeterReading,
  type Problem,
  type SimRunState,
  type ToolbarTool,
} from '@vircuitcad/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from './client';

const JOURNAL_FILE = 'autosave.vcad';
const CIRCUIT_FILE = 'circuit.vcad';

let appRenderCount = 0;

export function App() {
  appRenderCount += 1;
  window.__renderCount = appRenderCount;
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const simHostRef = useRef<SimulationHost | undefined>(undefined);
  const autosaveTimer = useRef<number | undefined>(undefined);
  const [store] = useState(() => new DocumentStore(createEmptyCircuit({ board: 'full' })));
  const registry = useMemo(() => createDefaultPartRegistry(), []);
  const client = useMemo(() => createClient(), []);
  const capabilities = useMemo(() => defaultCapabilities(), []);

  const [version, setVersion] = useState('…');
  const [tool, setTool] = useState<ToolbarTool>('select');
  const [selected, setSelected] = useState<PartInstance | undefined>(undefined);
  const [counts, setCounts] = useState({ parts: 0, wires: 0 });
  const [history, setHistory] = useState({ undo: false, redo: false });
  const [hoverPin, setHoverPin] = useState<PinHoverInfo | null>(null);
  const [wireColor, setWireColor] = useState(DEFAULT_WIRE_COLOR);
  const [dirty, setDirty] = useState(false);
  const [hint, setHint] = useState('Ready');
  const [simState, setSimState] = useState<SimRunState>('idle');
  const [simTime, setSimTime] = useState(0);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const [netColoring, setNetColoringState] = useState(false);
  const [meters, setMeters] = useState<MeterReading[]>([]);
  const [sketch, setSketch] = useState(() => sketchOf(store.getCircuit()).files['sketch.ino'] ?? '');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [codeOpen, setCodeOpen] = useState(false);
  const [, setSerialVersion] = useState(0);
  const sketchRef = useRef(sketch);
  sketchRef.current = sketch;
  const serialRef = useRef(new SerialBuffer());
  const mcuRef = useRef<McuCircuit | undefined>(undefined);
  const mcuTimer = useRef<number | undefined>(undefined);

  const toggleNetColoring = (): void => {
    setNetColoringState((previous) => {
      const next = !previous;
      editorRef.current?.setNetColoring(next);
      return next;
    });
  };

  const refresh = (): void => {
    const editor = editorRef.current;
    const circuit = store.getCircuit();
    const controller = editor?.getToolController();
    const selectedId = controller?.getSelectedPartId();
    setTool(controller?.getTool() ?? 'select');
    setSelected(selectedId ? circuit.parts.find((part) => part.id === selectedId) : undefined);
    setCounts({ parts: circuit.parts.length, wires: circuit.wires.length });
    const size = store.historySize();
    setHistory({ undo: size.undo > 0, redo: size.redo > 0 });
    setWireColor(controller?.getWireColor() ?? DEFAULT_WIRE_COLOR);
  };

  const circuitPath = async (): Promise<string> =>
    `${(await client.app.info()).paths.appData}/${CIRCUIT_FILE}`;

  const highlightError = (nets: readonly string[]): void => {
    const scene = editorRef.current?.getScene();
    if (!scene) return;
    if (nets.length === 0) {
      scene.setHighlight([]);
      return;
    }
    const netlist = extractNetlist(store.getCircuit(), registry);
    const partIds = new Set<string>();
    for (const net of netlist.nets) {
      if (nets.includes(net.name)) for (const pin of net.pins) partIds.add(pin.partId);
    }
    scene.setHighlight([...partIds]);
  };

  const runSim = (): void => simHostRef.current?.start(store.getCircuit());
  const stopSim = (): void => simHostRef.current?.stop();
  const togglePause = (): void => {
    if (simState === 'paused') simHostRef.current?.resume();
    else simHostRef.current?.pause();
  };

  const stopMcu = (): void => {
    if (mcuTimer.current !== undefined) window.clearInterval(mcuTimer.current);
    mcuTimer.current = undefined;
    mcuRef.current = undefined;
  };

  const startMcu = (hex: string): void => {
    stopMcu();
    const mcu = new McuCircuit(store.getCircuit(), registry, hex);
    mcuRef.current = mcu;
    mcu.onSerial((byte) => {
      serialRef.current.append(String.fromCharCode(byte), mcu.cycles / 16);
      setSerialVersion((version) => version + 1);
    });
    mcuTimer.current = window.setInterval(() => {
      mcu.runMicros(16_000);
      const leds = store
        .getCircuit()
        .parts.filter((part) => registry.get(part.partId)?.simModel === 'led')
        .map((part) => ({ partId: part.id, current: mcu.ledCurrent(part.id), burnedOut: false }));
      editorRef.current?.getScene()?.setSimulation({ leds });
    }, 1000 / 60);
  };

  const build = (): void => {
    stopMcu();
    const controller = new RunController({
      compile: async () => {
        const result = await client.compile.compile({
          source: sketchRef.current,
          fqbn: 'arduino:avr:uno',
        });
        setProblems(
          result.diagnostics.map((diagnostic) => ({
            file: 'sketch.ino',
            line: diagnostic.line ?? 1,
            column: diagnostic.column ?? 1,
            severity: diagnostic.severity,
            message: diagnostic.message,
          })),
        );
        return {
          ok: result.ok,
          ...(result.hex ? { hex: result.hex } : {}),
          diagnostics: result.diagnostics,
        };
      },
      onStart: startMcu,
      onStop: stopMcu,
    });
    controller.onChange = (state) => {
      setRunState(state);
      if (state === 'error') setToast('Build failed — see Problems');
    };
    void controller.build();
  };

  const scheduleAutosave = (): void => {
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void (async () => {
        const info = await client.app.info();
        const text = serializeCircuit(store.getCircuit());
        await client.fs.writeFile(
          `${info.paths.appData}/${JOURNAL_FILE}`,
          new TextEncoder().encode(text),
        );
        setHint('Autosaved');
      })();
    }, 400);
  };

  const save = async (): Promise<void> => {
    const fallback = await circuitPath();
    const picked = await client.dialogs.saveFile({
      defaultPath: fallback,
      filters: [{ name: 'VircuitCAD', extensions: ['vcad'] }],
    });
    const path = picked ?? fallback;
    await client.fs.writeFile(path, new TextEncoder().encode(serializeCircuit(store.getCircuit())));
    setDirty(false);
    setHint(`Saved ${path.split('/').pop() ?? path}`);
  };

  const load = async (): Promise<void> => {
    const fallback = await circuitPath();
    const picked = await client.dialogs.openFile({
      defaultPath: fallback,
      filters: [{ name: 'VircuitCAD', extensions: ['vcad'] }],
    });
    const path = picked ?? fallback;
    const bytes = await client.fs.readFile(path);
    store.replace(deserializeCircuit(new TextDecoder().decode(bytes)));
    setDirty(false);
    setHint(`Loaded ${path.split('/').pop() ?? path}`);
  };

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return undefined;

    let disposed = false;
    const editor = new Editor({ store, registry });
    editorRef.current = editor;
    window.__editor = editor;
    const disposers: Array<() => void> = [];

    const host = new SimulationHost();
    simHostRef.current = host;
    host.onStatus = (status) => setSimState(status.state);
    host.onSnapshot = (snapshot) => {
      editor.getScene()?.setSimulation(snapshot);
      setSimTime(snapshot.time);
      setMeters(snapshot.meters ?? []);
    };
    host.onError = (event) => {
      setToast(event.message);
      highlightError(event.nets ?? []);
    };
    disposers.push(() => host.dispose());

    void editor.mount(element).then(() => {
      if (disposed) return;
      const controller = editor.getToolController();
      if (controller) disposers.push(controller.onStateChange(refresh));
      refresh();
    });

    disposers.push(
      store.onChange(() => {
        setDirty(true);
        refresh();
        scheduleAutosave();
      }),
    );
    disposers.push(editor.onHoverPin(setHoverPin));

    void client.app.info().then((info) => setVersion(info.version)).catch(() => setVersion('unavailable'));

    window.__app = {
      store,
      getCircuit: () => store.getCircuit(),
      save,
      load,
      refresh,
      loadText: (text: string) => store.replace(deserializeCircuit(text)),
    };

    return () => {
      disposed = true;
      window.clearTimeout(autosaveTimer.current);
      stopMcu();
      for (const dispose of disposers) dispose();
      editor.unmount();
      editorRef.current = null;
      simHostRef.current = undefined;
      window.__editor = undefined;
      window.__app = undefined;
    };
  }, []);

  const controller = () => editorRef.current?.getToolController();

  useEffect(() => {
    const bridge = window.vircuitcad;
    if (!bridge?.onMenu) return;
    bridge.onMenu((command) => {
      switch (command) {
        case 'edit.undo':
          store.undo();
          break;
        case 'edit.redo':
          store.redo();
          break;
        case 'edit.delete':
          editorRef.current?.getToolController()?.keyDown('Delete');
          break;
        case 'edit.duplicate':
          editorRef.current?.getToolController()?.keyDown('d');
          break;
        default:
          break;
      }
    });
  }, [store]);

  const toolbar = (
    <>
      <Toolbar
        tool={tool}
        onTool={(next) => {
          controller()?.setTool(next);
          setTool(next);
        }}
        canUndo={history.undo}
        canRedo={history.redo}
        onUndo={() => store.undo()}
        onRedo={() => store.redo()}
        onRotate={() => controller()?.keyDown('r')}
        onDelete={() => controller()?.keyDown('Delete')}
        onDuplicate={() => controller()?.keyDown('d')}
        netColoring={netColoring}
        onToggleNetColoring={toggleNetColoring}
      />
      <div className="toolbar-spacer" />
      <button
        type="button"
        disabled={!capabilities.codeEditor}
        title={capabilities.codeEditor ? 'Toggle the code panel' : unavailableReason('codeEditor')}
        onClick={() => setCodeOpen((open) => !open)}
      >
        <ICONS.code />
        Code
      </button>
      <RunControls state={simState} onRun={runSim} onTogglePause={togglePause} onStop={stopSim} />
    </>
  );

  return (
    <AppShell
      toolbar={toolbar}
      left={
        <PartsBin
          registry={registry}
          onPick={(partId) => {
            controller()?.setTool('place', partId);
            setTool('place');
          }}
        />
      }
      right={
        <>
          <Inspector
            registry={registry}
            part={selected}
            onChange={(key: string, value: ParamValue) => {
              if (selected) store.setParam(selected.id, key, value);
            }}
          />
          <InstrumentPanel readings={meters} />
          {codeOpen ? (
            <>
              <div className="row">
                <button type="button" onClick={build}>
                  Build
                </button>
                <button type="button" onClick={stopMcu}>
                  Stop
                </button>
                <span data-testid="run-state">{runState}</span>
              </div>
              <div className="code-editor-host">
                <CodeEditor
                  value={sketch}
                  onChange={(text) => {
                    setSketch(text);
                    store.setSketchFile('sketch.ino', text);
                  }}
                />
              </div>
              <ProblemsPanel problems={problems} />
              <div className="serial-host">
                <SerialMonitor
                  lines={serialRef.current.toArray()}
                  onClear={() => {
                    serialRef.current.clear();
                    setSerialVersion((version) => version + 1);
                  }}
                />
              </div>
            </>
          ) : null}
        </>
      }
      status={
        <StatusBar
          partCount={counts.parts}
          wireCount={counts.wires}
          hint={dirty ? 'Unsaved changes' : hint}
          simState={simState}
          simTime={simTime}
          version={version}
        />
      }
    >
      <div ref={hostRef} data-testid="canvas-host" className="canvas-host" />
      {counts.parts === 0 && counts.wires === 0 ? (
        <p className="canvas-empty-hint" data-testid="canvas-empty-hint">
          Drag a part from the Parts panel onto the breadboard to start.
        </p>
      ) : null}
      {tool === 'wire' ? (
        <WireColorPicker
          color={wireColor}
          onChange={(color) => {
            controller()?.setWireColor(color);
            setWireColor(color);
          }}
        />
      ) : null}
      <CanvasControls viewport={editorRef.current ?? undefined} />
      {hoverPin ? (
        <div
          className="pin-tooltip"
          data-testid="pin-tooltip"
          style={{ left: hoverPin.screen.x, top: hoverPin.screen.y }}
        >
          {hoverPin.pinName}
          {hoverPin.netName ? ` · ${hoverPin.netName}` : ''}
        </div>
      ) : null}
      <Toast message={toast} onDismiss={() => setToast(undefined)} />
    </AppShell>
  );
}
