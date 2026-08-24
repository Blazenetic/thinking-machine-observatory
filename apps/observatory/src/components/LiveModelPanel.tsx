import { DISTILGPT2_MODEL } from '@observatory/inference-worker';

import { useLiveInference } from '../hooks/useLiveInference';
import { EvidenceBadge } from './EvidenceBadge';

interface LiveModelPanelProps {
  readonly prompt: string;
}

function capabilityLabel(available: boolean): string {
  return available ? 'available' : 'unavailable';
}

export function LiveModelPanel({ prompt }: LiveModelPanelProps) {
  const { cancel, capabilities, capture, load, predict, status } = useLiveInference();
  const canLoad = capabilities.webWorker && capabilities.secureContext;
  const ready = status.state === 'ready';

  return (
    <section aria-labelledby="live-model-title" className="live-model instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Feasibility instrument · experimental</p>
          <h2 id="live-model-title">Pinned local DistilGPT2 adapter</h2>
          <p>
            Genuine tokenizer IDs and top logits can be captured in a worker. Exact full-vocabulary
            sampling remains disabled until the export has golden-reference verification.
          </p>
        </div>
        <EvidenceBadge evidenceClass="measured" />
      </div>

      <div className="capability-grid" aria-label="Browser capability test">
        <p data-available={capabilities.secureContext}>
          Secure context <strong>{capabilityLabel(capabilities.secureContext)}</strong>
        </p>
        <p data-available={capabilities.webWorker}>
          Web Worker <strong>{capabilityLabel(capabilities.webWorker)}</strong>
        </p>
        <p data-available={capabilities.webGpu}>
          WebGPU <strong>{capabilityLabel(capabilities.webGpu)}</strong>
        </p>
        <p data-available={capabilities.indexedDb}>
          IndexedDB <strong>{capabilityLabel(capabilities.indexedDb)}</strong>
        </p>
      </div>

      <div className="model-manifest">
        <div>
          <span>Model</span>
          <strong>{DISTILGPT2_MODEL.id}</strong>
        </div>
        <div>
          <span>Revision</span>
          <code>{DISTILGPT2_MODEL.revision.slice(0, 12)}</code>
        </div>
        <div>
          <span>WASM dtype</span>
          <strong>int8</strong>
        </div>
        <div>
          <span>WebGPU dtype</span>
          <strong>fp16</strong>
        </div>
      </div>

      <div className="live-model__actions">
        <button
          className="secondary-button"
          disabled={!canLoad || status.state === 'loading' || status.state === 'predicting'}
          onClick={() => load('wasm')}
          type="button"
        >
          Load with WASM
        </button>
        <button
          className="secondary-button"
          disabled={
            !canLoad ||
            !capabilities.webGpu ||
            status.state === 'loading' ||
            status.state === 'predicting'
          }
          onClick={() => load('webgpu')}
          type="button"
        >
          Load with WebGPU
        </button>
        <button
          className="primary-button"
          disabled={!ready}
          onClick={() => predict(prompt)}
          type="button"
        >
          Measure next-token logits
        </button>
      </div>

      {status.state === 'loading' && (
        <div className="load-progress" role="status">
          <div>
            <span>{status.message}</span>
            <strong>{status.progress.toFixed(0)}%</strong>
          </div>
          <progress max="100" value={status.progress} />
          <button className="text-button" onClick={cancel} type="button">
            Cancel and return to demo
          </button>
        </div>
      )}
      {status.state === 'predicting' && <p role="status">Running local inference in the worker…</p>}
      {status.state === 'error' && (
        <div className="error-readout" role="alert">
          <strong>Local path unavailable</strong>
          <p>{status.message}</p>
          <p>The exact teaching fixture remains fully usable.</p>
        </div>
      )}

      {capture && (
        <div className="live-capture">
          <div className="live-capture__summary">
            <p>
              <strong>{capture.promptTokens.length}</strong> prompt tokens
            </p>
            <p>
              <strong>{capture.candidates.length}</strong> captured logits
            </p>
            <p>
              <strong>{capture.durationMs.toFixed(0)} ms</strong> inference
            </p>
            <p>
              <strong>{capture.mode.replace('live-', '')}</strong> backend
            </p>
          </div>
          <p className="integrity-callout integrity-callout--amber">
            Live measured output, unverified build. Only the top{' '}
            {capture.candidateUniverse.captured} of{' '}
            {capture.candidateUniverse.size.toLocaleString()} logits crossed the worker boundary, so
            this capture is inspectable but cannot enter the exact sampler or trace replay path yet.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Token</th>
                  <th scope="col">ID</th>
                  <th scope="col">Logit</th>
                </tr>
              </thead>
              <tbody>
                {capture.candidates.slice(0, 10).map((candidate, index) => (
                  <tr key={candidate.tokenId}>
                    <td>{index + 1}</td>
                    <th scope="row">{candidate.text.replaceAll(' ', '·')}</th>
                    <td>{candidate.tokenId}</td>
                    <td>{candidate.logit.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="instrument-note">
        Loading fetches a pinned model revision from Hugging Face and may download hundreds of
        megabytes. Prompts stay in this browser; no inference API is called.
      </p>
    </section>
  );
}
