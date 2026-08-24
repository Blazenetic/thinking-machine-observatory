import { useMemo, useState } from 'react';

import type { InstrumentCapability, TokenSpecimen } from '@observatory/domain';
import {
  buildTokenSpecimenRows,
  tokenSpecimenTextAlternative,
  type TokenSelectionSpecimen,
} from '@observatory/instruments';

import { EvidenceBadge } from './EvidenceBadge';

interface TokenSpecimenBenchProps {
  readonly capability: InstrumentCapability | null;
  readonly generated: readonly TokenSelectionSpecimen[];
  readonly pending: TokenSelectionSpecimen | null;
  readonly promptTokens: readonly TokenSpecimen[];
  readonly traceLabel: string;
}

const DEFAULT_LIMIT = 128;

function capabilityStatus(capability: InstrumentCapability | null): string {
  return capability?.status ?? 'unverified trace';
}

export function TokenSpecimenBench({
  capability,
  generated,
  pending,
  promptTokens,
  traceLabel,
}: TokenSpecimenBenchProps) {
  const [copyStatus, setCopyStatus] = useState('Copy table');
  const rows = useMemo(
    () => buildTokenSpecimenRows({ generated, pending, promptTokens }),
    [generated, pending, promptTokens],
  );
  const limit = capability?.limits.maxTokens ?? DEFAULT_LIMIT;
  const displayedRows = rows.slice(0, limit);
  const textAlternative = useMemo(
    () => tokenSpecimenTextAlternative(displayedRows),
    [displayedRows],
  );
  const reason =
    capability?.reason ??
    'These specimens came from a trace, but no active worker session has declared a token profile for this view.';

  const copyTable = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(textAlternative);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Select the text below');
    }
  };

  return (
    <section aria-labelledby="token-bench-title" className="token-bench trace-dock">
      <div className="instrument-heading instrument-heading--compact">
        <div>
          <p className="eyebrow">Token specimen bench · {traceLabel}</p>
          <h3 id="token-bench-title">Decoded fragments and UTF-8 bytes</h3>
          <p>
            Token IDs and decoded fragments are tokenizer outputs. Hexadecimal and decimal bytes are
            derived from each decoded fragment with a versioned UTF-8 method.
          </p>
        </div>
        <div className="token-bench__evidence">
          <EvidenceBadge compact evidenceClass="measured" />
          <EvidenceBadge compact evidenceClass="derived" />
          <strong data-status={capability?.status ?? 'unverified'}>
            {capabilityStatus(capability)}
          </strong>
        </div>
      </div>

      <dl className="instrument-provenance">
        <div>
          <dt>Source profile</dt>
          <dd>{capability?.profileId ?? 'No active profile'}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>{capability?.methodVersion ?? 'trace-record-only'}</dd>
        </div>
        <div>
          <dt>Display limit</dt>
          <dd>{limit} tokens</dd>
        </div>
        <div>
          <dt>Rendered</dt>
          <dd>
            {displayedRows.length} / {rows.length}
          </dd>
        </div>
      </dl>

      <p className="instrument-availability-note">{reason}</p>

      {displayedRows.length === 0 ? (
        <div className="instrument-unavailable" role="status">
          <strong>Awaiting token specimens</strong>
          <p>Load a model session, measure a prefix or import a compatible trace.</p>
        </div>
      ) : (
        <>
          <ol className="token-specimen-grid" aria-label="Active trace token specimens">
            {displayedRows.map((row) => (
              <li data-origin={row.origin} key={`${row.origin}-${row.position}-${row.tokenId}`}>
                <span>{String(row.position).padStart(2, '0')}</span>
                <strong aria-label={`Decoded fragment ${JSON.stringify(row.rawText)}`}>
                  {row.fragmentLabel}
                </strong>
                <small>{row.origin}</small>
                <code>id {row.tokenId}</code>
                <code>{row.byteHex || 'no bytes'}</code>
              </li>
            ))}
          </ol>

          <div className="table-scroll token-specimen-table">
            <table>
              <caption className="sr-only">
                Exact token positions, IDs, decoded fragments and derived UTF-8 bytes
              </caption>
              <thead>
                <tr>
                  <th scope="col">Position</th>
                  <th scope="col">Origin</th>
                  <th scope="col">Decoded fragment</th>
                  <th scope="col">Token ID</th>
                  <th scope="col">UTF-8 hex</th>
                  <th scope="col">UTF-8 decimal</th>
                  <th scope="col">Code points</th>
                  <th scope="col">Trace byte check</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => (
                  <tr key={`table-${row.origin}-${row.position}-${row.tokenId}`}>
                    <td>{row.position}</td>
                    <td>{row.origin}</td>
                    <th scope="row">{row.fragmentLabel}</th>
                    <td>{row.tokenId}</td>
                    <td>{row.byteHex || 'none'}</td>
                    <td>{row.byteDecimal || 'none'}</td>
                    <td>{row.codePoints}</td>
                    <td>
                      {row.recordedBytesMatch === null
                        ? 'derived now'
                        : row.recordedBytesMatch
                          ? 'matches'
                          : 'mismatch'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="token-text-alternative">
            <summary>Copyable text alternative</summary>
            <button className="text-button" onClick={() => void copyTable()} type="button">
              {copyStatus}
            </button>
            <textarea
              aria-label="Token specimen tab-separated text"
              readOnly
              value={textAlternative}
            />
          </details>
        </>
      )}

      <p className="instrument-note">
        These are bytes of decoded fragments. They are not original prompt offsets and are not
        tokenizer-internal merge symbols. Replacement characters are displayed literally as �.
      </p>
    </section>
  );
}
