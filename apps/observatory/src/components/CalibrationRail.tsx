import type { SamplerConfig } from '@observatory/domain';

interface CalibrationRailProps {
  readonly branchCount: number;
  readonly config: SamplerConfig;
  readonly forcedToken: string | null;
  readonly onCommit: () => void;
  readonly onConfigChange: (config: SamplerConfig) => void;
  readonly onForceRunnerUp: () => void;
  readonly onReset: () => void;
  readonly selectedToken: string;
  readonly suppressedCount: number;
}

export function CalibrationRail({
  branchCount,
  config,
  forcedToken,
  onCommit,
  onConfigChange,
  onForceRunnerUp,
  onReset,
  selectedToken,
  suppressedCount,
}: CalibrationRailProps) {
  const update = <Key extends keyof SamplerConfig>(key: Key, value: SamplerConfig[Key]) =>
    onConfigChange({ ...config, [key]: value });

  return (
    <aside aria-labelledby="calibration-title" className="calibration-rail instrument-frame">
      <div className="instrument-heading instrument-heading--compact">
        <div>
          <p className="eyebrow">Intervention console</p>
          <h2 id="calibration-title">Calibrate</h2>
        </div>
        <button className="text-button" onClick={onReset} type="button">
          Reset
        </button>
      </div>

      <fieldset className="mode-switch">
        <legend>Selection mode</legend>
        <label>
          <input
            checked={config.mode === 'sampled'}
            name="sampler-mode"
            onChange={() => update('mode', 'sampled')}
            type="radio"
          />
          Seeded sample
        </label>
        <label>
          <input
            checked={config.mode === 'greedy'}
            name="sampler-mode"
            onChange={() => update('mode', 'greedy')}
            type="radio"
          />
          Greedy
        </label>
      </fieldset>

      <div className="calibration-control">
        <div className="calibration-control__label">
          <label htmlFor="temperature">Temperature</label>
          <output htmlFor="temperature">{config.temperature.toFixed(2)}</output>
        </div>
        <input
          id="temperature"
          max="2"
          min="0.1"
          onChange={(event) => update('temperature', Number(event.target.value))}
          step="0.05"
          type="range"
          value={config.temperature}
        />
        <div className="calibration-control__scale" aria-hidden="true">
          <span>sharp</span>
          <span>flat</span>
        </div>
      </div>

      <div className="calibration-control">
        <div className="calibration-control__label">
          <label htmlFor="top-k">Top-k</label>
          <output htmlFor="top-k">{config.topK ?? 'all'}</output>
        </div>
        <input
          id="top-k"
          max="10"
          min="1"
          onChange={(event) => update('topK', Number(event.target.value))}
          step="1"
          type="range"
          value={config.topK ?? 10}
        />
        <button
          aria-pressed={config.topK === null}
          className="micro-button calibration-control__toggle"
          onClick={() => update('topK', config.topK === null ? 8 : null)}
          type="button"
        >
          {config.topK === null ? 'All candidates' : 'Remove top-k limit'}
        </button>
      </div>

      <div className="calibration-control">
        <div className="calibration-control__label">
          <label htmlFor="top-p">Top-p</label>
          <output htmlFor="top-p">{config.topP.toFixed(2)}</output>
        </div>
        <input
          id="top-p"
          max="1"
          min="0.05"
          onChange={(event) => update('topP', Number(event.target.value))}
          step="0.05"
          type="range"
          value={config.topP}
        />
      </div>

      <div className="calibration-control">
        <label htmlFor="seed">Seed</label>
        <input
          className="text-input text-input--mono"
          disabled={config.mode === 'greedy'}
          id="seed"
          onChange={(event) => update('seed', event.target.value || '0')}
          spellCheck="false"
          type="text"
          value={config.seed}
        />
      </div>

      <dl className="intervention-readout">
        <div>
          <dt>Preview token</dt>
          <dd>{selectedToken.replaceAll(' ', '·')}</dd>
        </div>
        <div>
          <dt>Forced</dt>
          <dd>{forcedToken?.replaceAll(' ', '·') ?? 'none'}</dd>
        </div>
        <div>
          <dt>Suppressed</dt>
          <dd>{suppressedCount}</dd>
        </div>
      </dl>

      <div className="calibration-actions">
        <button className="primary-button" onClick={onCommit} type="button">
          Commit branch {branchCount + 1}
        </button>
        <button className="secondary-button" onClick={onForceRunnerUp} type="button">
          Force runner-up branch
        </button>
      </div>
      <p className="instrument-note">
        Calibration previews are reversible. Committing creates a child trace; the baseline remains
        byte-stable.
      </p>
    </aside>
  );
}
