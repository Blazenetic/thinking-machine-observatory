import type { ExperimentTrace } from '@observatory/domain';
import { compareBranches } from '@observatory/instruments';

import { EvidenceBadge } from './EvidenceBadge';

interface BranchChamberProps {
  readonly baseline: ExperimentTrace;
  readonly branches: readonly ExperimentTrace[];
  readonly onExport: (trace: ExperimentTrace) => void;
  readonly onSelect: (traceId: string) => void;
  readonly selectedTraceId: string;
}

function tokenLabel(trace: ExperimentTrace): string {
  return trace.steps.at(-1)?.sampler.selection.text.replaceAll(' ', '·') ?? '—';
}

export function BranchChamber({
  baseline,
  branches,
  onExport,
  onSelect,
  selectedTraceId,
}: BranchChamberProps) {
  const selected = branches.find((branch) => branch.traceId === selectedTraceId) ?? baseline;
  const comparison =
    selected.traceId === baseline.traceId ? null : compareBranches(baseline, selected);
  const traces = [baseline, ...branches];

  return (
    <section aria-labelledby="branch-title" className="branch-chamber instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Counterfactual lineage</p>
          <h2 id="branch-title">Branch chamber</h2>
          <p>Select a child trace to compare it with the immutable baseline.</p>
        </div>
        <EvidenceBadge evidenceClass="interventional" />
      </div>

      <div className="branch-layout">
        <div className="branch-lineage" aria-label="Experiment trace branches">
          {traces.map((trace, index) => {
            const selection = trace.steps.at(-1)?.sampler.selection;
            const isSelected = trace.traceId === selected.traceId;
            return (
              <button
                aria-pressed={isSelected}
                className={`branch-node${index === 0 ? ' branch-node--root' : ''}${isSelected ? ' branch-node--active' : ''}`}
                key={trace.traceId}
                onClick={() => onSelect(trace.traceId)}
                type="button"
              >
                <span className="branch-node__index">{index === 0 ? 'ROOT' : `B${index}`}</span>
                <span className="branch-node__title">{trace.title}</span>
                <strong>{tokenLabel(trace)}</strong>
                <span>
                  {selection?.mode ?? 'empty'} · H{' '}
                  {trace.steps.at(-1)?.sampler.entropyBits.toFixed(3) ?? '—'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="branch-comparison" aria-live="polite">
          {comparison ? (
            <>
              <div className="comparison-pair" aria-label="Compared selected tokens">
                <span>
                  Baseline <strong>{tokenLabel(baseline)}</strong>
                </span>
                <span aria-hidden="true">⇄</span>
                <span>
                  {selected.title} <strong>{tokenLabel(selected)}</strong>
                </span>
              </div>
              <dl className="metric-grid">
                <div>
                  <dt>First token divergence</dt>
                  <dd>
                    {comparison.firstDivergenceStep === null
                      ? 'none'
                      : `step ${comparison.firstDivergenceStep + 1}`}
                  </dd>
                </div>
                <div>
                  <dt>Jensen–Shannon</dt>
                  <dd>
                    {comparison.jensenShannonBits === null
                      ? '—'
                      : `${comparison.jensenShannonBits.toFixed(4)} bits`}
                  </dd>
                </div>
                <div>
                  <dt>Entropy delta</dt>
                  <dd>
                    {comparison.entropyDeltaBits === null
                      ? '—'
                      : `${comparison.entropyDeltaBits >= 0 ? '+' : ''}${comparison.entropyDeltaBits.toFixed(4)} bits`}
                  </dd>
                </div>
                <div>
                  <dt>Distribution compatible</dt>
                  <dd>{comparison.compatible ? 'yes' : 'no'}</dd>
                </div>
              </dl>
              <p className="instrument-note">
                Jensen–Shannon divergence compares the final distributions over this fixture
                universe. A forced token can change the selection while leaving the distribution
                unchanged.
              </p>
            </>
          ) : (
            <div className="branch-empty">
              <span aria-hidden="true">⌁</span>
              <p>Commit an intervention to open a counterfactual comparison.</p>
            </div>
          )}
          <button className="secondary-button" onClick={() => onExport(selected)} type="button">
            Export selected trace JSON
          </button>
        </div>
      </div>
    </section>
  );
}
