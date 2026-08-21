import useVisualizerStore from '../store/useVisualizerStore';

const SLIDERS = [
  { key: 'bass', label: 'Bass reactivity', min: 0, max: 3, step: 0.05 },
  { key: 'mid', label: 'Mid reactivity', min: 0, max: 3, step: 0.05 },
  { key: 'treble', label: 'Treble reactivity', min: 0, max: 3, step: 0.05 },
  { key: 'beatThreshold', label: 'Beat sensitivity (lower = more triggers)', min: 1.05, max: 2.0, step: 0.01 }
];

export default function SensitivityPanel({ audioApi }) {
  const sensitivity = useVisualizerStore((s) => s.sensitivity);
  const setSensitivity = useVisualizerStore((s) => s.setSensitivity);
  const bloomIntensity = useVisualizerStore((s) => s.bloomIntensity);
  const setSetting = useVisualizerStore((s) => s.setSetting);

  const onChange = (key, value) => {
    const partial = { [key]: value };
    setSensitivity(partial);
    audioApi.setSensitivity(partial);
  };

  return (
    <div className="sensitivity-panel">
      <h3>Reactivity</h3>
      {SLIDERS.map(({ key, label, min, max, step }) => (
        <label key={key} className="sensitivity-panel__row">
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sensitivity[key]}
            onChange={(e) => onChange(key, parseFloat(e.target.value))}
          />
          <span className="sensitivity-panel__value">{sensitivity[key].toFixed(2)}</span>
        </label>
      ))}

      <label className="sensitivity-panel__row">
        <span>Bloom intensity</span>
        <input
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={bloomIntensity}
          onChange={(e) => setSetting('bloomIntensity', parseFloat(e.target.value))}
        />
        <span className="sensitivity-panel__value">{bloomIntensity.toFixed(2)}</span>
      </label>
    </div>
  );
}
