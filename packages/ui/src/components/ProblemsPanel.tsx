export type Problem = {
  file: string;
  line: number;
  column: number;
  severity: string;
  message: string;
};

export type ProblemsPanelProps = {
  problems: Problem[];
  onSelect?: (problem: Problem) => void;
};

export function ProblemsPanel({ problems, onSelect }: ProblemsPanelProps) {
  if (problems.length === 0) {
    return <p className="problems-empty">No problems</p>;
  }
  return (
    <ul className="problems" aria-label="Problems">
      {problems.map((problem, index) => (
        <li key={`${problem.file}:${problem.line}:${problem.column}:${index}`}>
          <button type="button" onClick={() => onSelect?.(problem)}>
            {problem.file}:{problem.line}:{problem.column} [{problem.severity}] {problem.message}
          </button>
        </li>
      ))}
    </ul>
  );
}
