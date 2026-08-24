import type { GenerationStep } from '@observatory/domain';
import { buildProbabilityRows } from '@observatory/instruments';

import { EvidenceBadge } from './EvidenceBadge';

interface ProbabilitySpectrometerProps {
  readonly forcedTokenId: number | null;
  readonly onForce: (tokenId: number | null) => void;
  readonly onToggleSuppression: (tokenId: number) => void;
  readonly step: GenerationStep;
  readonly suppressedTokenIds: readonly number[];
}

function visibleToken(text: string): string {
  return text.replaceAll(' ', '·').replaceAll('\n', '↵');
}

function eliminationLabel(reason: string | null): string {
  if (reason === 'top-k') return 'removed by top-k';
  if (reason === 'top-p') return 'removed by top-p';
  if (reason === 'suppressed') return 'suppressed manually';
  return 'survives filters';
}

export function ProbabilitySpectrometer({
  forcedTokenId,
  onForce,
  onToggleSuppression,
  step,
  suppressedTokenIds,
}: ProbabilitySpectrometerProps) {
  const rows = buildProbabilityRows(step);

  return (
    <section aria-labelledby="spectrometer-title" className="spectrometer instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Primary instrument · pre-selection</p>
          <h2 id="spectrometer-title">Probability spectrometer</h2>
          <p>
            A full zero-to-one scale. Filters contract the candidate field; exact values remain in
            the table.
          </p>
        </div>
        <div className="evidence-pair">
          <EvidenceBadge evidenceClass="derived" />
          {forcedTokenId !== null && <EvidenceBadge evidenceClass="interventional" />}
        </div>
      </div>

      <div className="spectrometer__axis" aria-hidden="true">
        <span>0</span>
        <span>probability mass</span>
        <span>1</span>
      </div>
      <p className="candidate-universe">{step.candidateUniverse.label}</p>

      <div className="candidate-field">
        {rows.map((row) => {
          const suppressed = suppressedTokenIds.includes(row.tokenId);
          const forced = forcedTokenId === row.tokenId;
          return (
            <article
              aria-label={`Rank ${row.rank}, token ${row.text}, ${(row.finalProbability * 100).toFixed(2)} percent, ${eliminationLabel(row.eliminationReason)}`}
              className={`candidate-row${row.eliminationReason ? ' candidate-row--filtered' : ''}${row.selected ? ' candidate-row--selected' : ''}`}
              key={row.tokenId}
            >
              <div className="candidate-row__identity">
                <span className="candidate-row__rank">{String(row.rank).padStart(2, '0')}</span>
                <span className="candidate-row__token">{visibleToken(row.text)}</span>
                <span className="candidate-row__id">#{row.tokenId}</span>
              </div>
              <div className="candidate-row__plot">
                <span
                  className="candidate-row__bar"
                  style={{ inlineSize: `${row.finalProbability * 100}%` }}
                />
                {row.selected && <span className="candidate-row__selection">selected</span>}
              </div>
              <div className="candidate-row__reading">
                <strong>{(row.finalProbability * 100).toFixed(2)}%</strong>
                <span>{row.eliminationReason ?? 'retained'}</span>
              </div>
              <div className="candidate-row__actions">
                <button
                  aria-pressed={forced}
                  className="micro-button"
                  onClick={() => onForce(forced ? null : row.tokenId)}
                  type="button"
                >
                  {forced ? 'Unforce' : 'Force'}
                </button>
                <button
                  aria-pressed={suppressed}
                  className="micro-button"
                  disabled={forced}
                  onClick={() => onToggleSuppression(row.tokenId)}
                  type="button"
                >
                  {suppressed ? 'Restore' : 'Suppress'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <details className="data-table-disclosure">
        <summary>Exact candidate table</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Token</th>
                <th scope="col">Logit</th>
                <th scope="col">Before top-p</th>
                <th scope="col">Cumulative</th>
                <th scope="col">Final</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tokenId}>
                  <td>{row.rank}</td>
                  <th scope="row">{visibleToken(row.text)}</th>
                  <td>{row.logit.toFixed(3)}</td>
                  <td>{(row.probabilityBeforeTopP * 100).toFixed(3)}%</td>
                  <td>
                    {row.cumulativeProbabilityBeforeTopP === null
                      ? '—'
                      : `${(row.cumulativeProbabilityBeforeTopP * 100).toFixed(3)}%`}
                  </td>
                  <td>{(row.finalProbability * 100).toFixed(3)}%</td>
                  <td>{eliminationLabel(row.eliminationReason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
