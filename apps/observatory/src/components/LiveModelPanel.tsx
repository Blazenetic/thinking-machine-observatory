import { useMemo, useState } from 'react';

import type { ExperimentTrace } from '@observatory/domain';
import {
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_VERIFICATION,
} from '@observatory/inference-worker';
import { replayTrace } from '@observatory/trace-schema';

import { assertAcceptedLiveTrace, createLiveTrace } from '../data/live';
import { useLiveInference } from '../hooks/useLiveInference';
import { downloadTrace, readTraceFile, traceByteLength } from '../utils/traceFiles';
import { EvidenceBadge } from './EvidenceBadge';

interface LiveModelPanelProps {
  readonly prompt: string;
}

function capabilityLabel(available: boolean): string {
  return available ? 'available' : 'unavailable';
}

function cacheLabel(status: 'cold-download' | 'unavailable' | 'warm-cache'): string {
  if (status === 'warm-cache') return 'warm cache';
  if (status === 'cold-download') return 'cold download';
  return 'not exposed';
}

export function LiveModelPanel({ prompt }: LiveModelPanelProps) {
  const { cancel, capabilities, capture, load, predict, status } = useLiveInference();
  const [committedTrace, setCommittedTrace] = useState<ExperimentTrace | null>(null);
  const [traceMessage, setTraceMessage] = useState(
    'No live trace committed. A verified import can be replayed without loading the model.',
  );
  const canLoad = capabilities.webWorker && capabilities.secureContext;
  const ready = status.state === 'ready';
  const committedTraceBytes = useMemo(
    () => (committedTrace ? traceByteLength(committedTrace) : null),
    [committedTrace],
  );

  const commitCapture = () => {
    if (!capture) return;
    try {
      const trace = createLiveTrace(prompt, capture);
      const replay = replayTrace(trace);
      if (!replay.matches) throw new Error('The committed trace did not replay exactly.');
      setCommittedTrace(trace);
      setTraceMessage(
        `Committed and replayed token ${trace.steps[0]?.sampler.selection.text.trim() || trace.steps[0]?.sampler.selection.tokenId}.`,
      );
    } catch (error) {
      setTraceMessage(
        error instanceof Error ? error.message : 'The live trace could not be committed.',
      );
    }
  };

  const importTrace = async (file: File) => {
    try {
      const trace = await readTraceFile(file);
      assertAcceptedLiveTrace(trace);
      const replay = replayTrace(trace);
      if (!replay.matches) throw new Error('Imported trace failed deterministic replay.');
      setCommittedTrace(trace);
      setTraceMessage(`Imported ${trace.traceId}; every recorded step replayed exactly.`);
    } catch (error) {
      setTraceMessage(error instanceof Error ? error.message : 'Trace import failed.');
    }
  };

  return (
    <section aria-labelledby="live-model-title" className="live-model instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Verified local instrument · Phase 2</p>
          <h2 id="live-model-title">Full-vocabulary DistilGPT2 observatory</h2>
          <p>
            The pinned WASM fp32 graph carries every logit through the worker, exact sampler and
            replayable trace. WebGPU remains an explicitly unverified experiment.
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
          <span>WASM fp32</span>
          <strong>golden verified</strong>
        </div>
        <div>
          <span>WebGPU dtype</span>
          <strong>fp16 · unverified</strong>
        </div>
      </div>

      <p className="integrity-callout integrity-callout--amber">
        The smaller int8 graph remains available only as recorded evidence: it failed two top-1
        checks and the causal-prefix gate. It is not used by the live sampler. Accepted fp32 asset{' '}
        <code>{DISTILGPT2_ASSETS.wasmFp32.sha256.slice(0, 12)}</code>…
      </p>

      <div className="live-model__actions">
        <button
          className="secondary-button"
          disabled={!canLoad || status.state === 'loading' || status.state === 'predicting'}
          onClick={() => load('wasm')}
          type="button"
        >
          Load verified WASM
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
          Measure full vocabulary
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
              <strong>{capture.candidateUniverse.captured.toLocaleString()}</strong> complete logits
            </p>
            <p>
              <strong>{capture.durationMs.toFixed(0)} ms</strong> inference
            </p>
            <p>
              <strong>{capture.mode.replace('live-', '')}</strong> backend
            </p>
            {status.state === 'ready' && (
              <p>
                <strong>{cacheLabel(status.load.cacheStatus)}</strong> asset state
              </p>
            )}
            {status.state === 'ready' && (
              <p>
                <strong>{(status.load.durationMs / 1000).toFixed(1)} s</strong> model load
              </p>
            )}
          </div>
          <p
            className={`integrity-callout ${capture.model.verificationStatus === 'verified' ? 'integrity-callout--verified' : 'integrity-callout--amber'}`}
          >
            {capture.model.verificationStatus === 'verified'
              ? `Verified measured output. All ${capture.candidateUniverse.size.toLocaleString()} logits crossed the worker boundary under ${DISTILGPT2_VERIFICATION.wasmFp32.profileId}; exact sampling and replay are enabled.`
              : 'Measured WebGPU output from an unverified backend. Inspection is allowed; exact trace commitment remains disabled.'}
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

      <section aria-labelledby="live-trace-title" className="trace-dock">
        <div className="trace-dock__heading">
          <div>
            <p className="eyebrow">Trace dock · schema 1.1</p>
            <h3 id="live-trace-title">Commit, import and replay</h3>
          </div>
          <strong>{committedTrace ? 'Replay exact' : 'Awaiting trace'}</strong>
        </div>
        <div className="live-model__actions live-model__actions--trace">
          <button
            className="primary-button"
            disabled={
              !capture ||
              !capture.candidateUniverse.complete ||
              capture.model.verificationStatus !== 'verified'
            }
            onClick={commitCapture}
            type="button"
          >
            Commit verified trace
          </button>
          <label className="secondary-button trace-file-button">
            Import and replay JSON
            <input
              accept=".json,application/json"
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (file) void importTrace(file).finally(() => (input.value = ''));
              }}
              type="file"
            />
          </label>
          <button
            className="secondary-button"
            disabled={!committedTrace}
            onClick={() => committedTrace && downloadTrace(committedTrace)}
            type="button"
          >
            Export trace JSON
          </button>
        </div>
        <p aria-live="polite" className="trace-dock__status">
          {traceMessage}
        </p>
        {committedTrace && committedTraceBytes !== null && (
          <dl className="trace-dock__readout">
            <div>
              <dt>Selected token</dt>
              <dd>
                {committedTrace.steps[0]?.sampler.selection.text.replaceAll(' ', '·') ||
                  committedTrace.steps[0]?.sampler.selection.tokenId}
              </dd>
            </div>
            <div>
              <dt>Candidate records</dt>
              <dd>{committedTrace.steps[0]?.sampler.candidates.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt>JSON size</dt>
              <dd>{(committedTraceBytes / 1024 / 1024).toFixed(2)} MiB</dd>
            </div>
            <div>
              <dt>Logit SHA-256</dt>
              <dd>{committedTrace.steps[0]?.inference.logitsSha256?.slice(0, 12)}…</dd>
            </div>
          </dl>
        )}
      </section>

      <p className="instrument-note">
        The accepted fp32 graph is 327.8 MB. Loading is opt-in and cached where the browser exposes
        Cache Storage. Prompts and full logits stay in this browser; no inference API is called.
      </p>
    </section>
  );
}
