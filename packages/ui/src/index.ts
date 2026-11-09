export { PartsBin, type PartsBinProps } from './components/PartsBin';
export { Inspector, type InspectorProps } from './components/Inspector';
export { Toolbar, type ToolbarProps, type ToolbarTool } from './components/Toolbar';
export { StatusBar, type StatusBarProps } from './components/StatusBar';
export { RunControls, type RunControlsProps, type SimRunState } from './components/RunControls';
export { Toast, type ToastProps } from './components/Toast';
export { SerialBuffer, withLineEnding, type LineEnding, type SerialLine } from './serial/buffer';
export { ProblemsPanel, type Problem, type ProblemsPanelProps } from './components/ProblemsPanel';
export { SerialMonitor, type SerialMonitorProps } from './serial/SerialMonitor';
export {
  InstrumentPanel,
  type InstrumentPanelProps,
  type MeterReading,
} from './components/InstrumentPanel';

export { CodeEditor, type CodeEditorProps } from './code/CodeEditor';
export {
  ARDUINO_CONSTANTS,
  ARDUINO_FUNCTIONS,
  ARDUINO_KEYWORDS,
  arduinoCompletions,
  type ArduinoCompletion,
} from './code/arduino-keywords';

export const packageName = '@vircuitcad/ui';
