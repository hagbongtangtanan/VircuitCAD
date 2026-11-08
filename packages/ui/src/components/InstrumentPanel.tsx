export type MeterReading = {
  partId: string;
  mode: string;
  value: number | null;
  unit: string;
};

export type InstrumentPanelProps = {
  readings: MeterReading[];
};

export function InstrumentPanel({ readings }: InstrumentPanelProps) {
  if (readings.length === 0) return null;
  return (
    <div className="instruments" aria-label="Instruments">
      <h3>Instruments</h3>
      <ul>
        {readings.map((reading) => (
          <li key={reading.partId} data-testid={`meter-${reading.partId}`}>
            <strong>{reading.mode}</strong>{' '}
            {reading.value === null ? '---' : reading.value.toPrecision(3)} {reading.unit}
          </li>
        ))}
      </ul>
    </div>
  );
}
