import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  InstrumentCapabilityStatus,
  SamplerConfig,
  SamplerInterventions,
} from '@observatory/domain';
import {
  formatExperimentReflection,
  type ExperimentEvaluation,
  type ExperimentObservationSnapshot,
  type VersionedGuidedExperiment,
} from '@observatory/experiments';
import {
  acceptInferenceCapture,
  beginGenerationCommit,
  completeGenerationCommit,
  createGenerationControllerState,
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_VERIFICATION,
  failGeneration,
  sameGenerationRequest,
  setAutoAdvance,
  startGeneration,
  stopGeneration,
  type GenerationControllerState,
  type GenerationRequestContext,
} from '@observatory/inference-worker';
import {
  appendCompactGenerationStep,
  appendCompactTraceAnnotation,
  compareCompactTraceSelections,
  forkCompactTrace,
  IndexedDbTraceNotebook,
  replayCompactTraceBundle,
  resampleCompactGenerationStep,
  resolveCompactTraceHistory,
  selectCompactTrace,
  type CompactStepWithPayload,
  type CompactTraceBundle,
  type NotebookDataReport,
} from '@observatory/trace-schema';

import {
  assertAcceptedCompactLiveBundle,
  createCompactLiveRoot,
  createCompactLiveStep,
  VERIFIED_LIVE_CONFIG,
} from '../data/live';
import { useLiveInference } from '../hooks/useLiveInference';
import {
  downloadPortableTrace,
  portableTraceByteLength,
  readPortableTraceFile,
} from '../utils/traceFiles';
import { EvidenceBadge } from './EvidenceBadge';
import { CapabilityInstrumentRack } from './CapabilityInstrumentRack';
import { LiveExperimentNotebook } from './LiveExperimentNotebook';
import { TokenSpecimenBench } from './TokenSpecimenBench';

interface LiveModelPanelProps {
  readonly prompt: string;
}

const EOS_TOKEN_ID = 50_256;
const MAX_GENERATED_STEPS = 64;

function capabilityLabel(available: boolean): string {
  return available ? 'available' : 'unavailable';
}

function cacheLabel(status: 'cold-download' | 'unavailable' | 'warm-cache'): string {
  if (status === 'warm-cache') return 'warm cache';
  if (status === 'cold-download') return 'cold download';
  return 'not exposed';
}

function visibleToken(text: string, tokenId: number): string {
  return text.length > 0 ? text.replaceAll(' ', '·') : `token ${tokenId}`;
}

function effectiveInputTokenIds(bundle: CompactTraceBundle, traceId: string): readonly number[] {
  const trace = bundle.traces.find((item) => item.traceId === traceId);
  if (!trace) return [];
  return [
    ...trace.promptTokens.map((token) => token.tokenId),
    ...resolveCompactTraceHistory(bundle, traceId).map((step) => step.sampler.selection.tokenId),
  ];
}

function effectivePrompt(bundle: CompactTraceBundle, traceId: string): string {
  const trace = bundle.traces.find((item) => item.traceId === traceId);
  if (!trace) return '';
  return `${trace.prompt}${resolveCompactTraceHistory(bundle, traceId)
    .map((step) => step.sampler.selection.text)
    .join('')}`;
}

function controllerFor(context: GenerationRequestContext): GenerationControllerState {
  return startGeneration(createGenerationControllerState(context.workerEpoch), {
    generationId: context.generationId,
    workerEpoch: context.workerEpoch,
  });
}

export function LiveModelPanel({ prompt }: LiveModelPanelProps) {
  const {
    cancel,
    capabilities,
    capture,
    captureContext,
    instrumentCapabilities,
    load,
    predict,
    status,
    stop,
  } = useLiveInference();
  const [bundle, setBundle] = useState<CompactTraceBundle | null>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CompactStepWithPayload | null>(null);
  const [controller, setController] = useState<GenerationControllerState>(() =>
    createGenerationControllerState(),
  );
  const [config, setConfig] = useState<SamplerConfig>(VERIFIED_LIVE_CONFIG);
  const [forcedTokenId, setForcedTokenId] = useState<number | null>(null);
  const [suppressedTokenIds, setSuppressedTokenIds] = useState<readonly number[]>([]);
  const [traceMessage, setTraceMessage] = useState(
    'Load the verified model, then pause on a complete distribution before committing.',
  );
  const [forkStep, setForkStep] = useState(0);
  const [notebookReport, setNotebookReport] = useState<NotebookDataReport | null>(null);
  const notebookReference = useRef<IndexedDbTraceNotebook | null>(null);
  const nextTraceIdReference = useRef<string | null>(null);

  const canLoad = capabilities.webWorker && capabilities.secureContext;
  const verifiedReady = status.state === 'ready' && status.model.verificationStatus === 'verified';
  const interventions = useMemo<SamplerInterventions>(
    () => ({ forcedTokenId, suppressedTokenIds }),
    [forcedTokenId, suppressedTokenIds],
  );
  const resolvedActiveTraceId = activeTraceId ?? bundle?.rootTraceId ?? null;
  const activeHistory = useMemo(
    () =>
      bundle && resolvedActiveTraceId
        ? resolveCompactTraceHistory(bundle, resolvedActiveTraceId)
        : [],
    [bundle, resolvedActiveTraceId],
  );
  const activeTrace = useMemo(
    () => bundle?.traces.find((trace) => trace.traceId === resolvedActiveTraceId) ?? null,
    [bundle, resolvedActiveTraceId],
  );
  const tokenCapability =
    instrumentCapabilities.find((capability) => capability.id === 'token-specimens') ?? null;
  const experimentObservations = useMemo<ExperimentObservationSnapshot>(() => {
    const histories = bundle
      ? bundle.traces.map((trace) => resolveCompactTraceHistory(bundle, trace.traceId))
      : [];
    const steps = histories.flat();
    const capabilityStatuses: Partial<
      Record<(typeof instrumentCapabilities)[number]['id'], InstrumentCapabilityStatus>
    > = {};
    for (const capability of instrumentCapabilities) {
      capabilityStatuses[capability.id] = capability.status;
    }
    return {
      attentionInterventions: 0,
      capabilities: capabilityStatuses,
      distinctPrompts: new Set(bundle?.traces.map((trace) => trace.prompt) ?? []).size,
      distinctSeeds: new Set(steps.map((step) => step.sampler.config.seed)).size,
      distinctTemperatures: new Set(steps.map((step) => step.sampler.config.temperature)).size,
      distinctTopP: new Set(steps.map((step) => step.sampler.config.topP)).size,
      forcedSelections: steps.filter((step) => step.sampler.selection.mode === 'forced').length,
      probeSweeps: 0,
      tokenSpecimens: activeTrace?.promptTokens.length ?? 0,
      whitespaceBoundaries:
        activeTrace?.promptTokens.filter((token) => token.text.startsWith(' ')).length ?? 0,
    };
  }, [activeTrace, bundle, instrumentCapabilities]);
  const baselineTraceId = bundle?.traces[0]?.traceId ?? null;
  const comparison = useMemo(
    () =>
      bundle &&
      baselineTraceId &&
      resolvedActiveTraceId &&
      baselineTraceId !== resolvedActiveTraceId
        ? compareCompactTraceSelections(bundle, baselineTraceId, resolvedActiveTraceId)
        : null,
    [baselineTraceId, bundle, resolvedActiveTraceId],
  );
  const bundleBytes = useMemo(() => (bundle ? portableTraceByteLength(bundle) : null), [bundle]);

  const appendExperimentReflection = useCallback(
    (
      experiment: VersionedGuidedExperiment,
      reflection: string,
      observationStatus: ExperimentEvaluation['status'],
    ) => {
      if (!bundle || !resolvedActiveTraceId) return;
      const note = formatExperimentReflection({
        experimentId: experiment.id,
        experimentVersion: experiment.protocolVersion,
        observationStatus,
        reflection,
      });
      const annotated = appendCompactTraceAnnotation(bundle, resolvedActiveTraceId, {
        note,
        step: activeHistory.length > 0 ? activeHistory.length - 1 : null,
      });
      setBundle(annotated);
      setTraceMessage(
        `Reflection appended to ${activeTrace?.title ?? resolvedActiveTraceId}; export or save the bundle to retain it.`,
      );
    },
    [activeHistory.length, activeTrace?.title, bundle, resolvedActiveTraceId],
  );

  const startNewBaseline = useCallback(() => {
    const traceId = `live-${globalThis.crypto.randomUUID()}`;
    nextTraceIdReference.current = traceId;
    setBundle(null);
    setActiveTraceId(traceId);
    setPreview(null);
    setForcedTokenId(null);
    setSuppressedTokenIds([]);
    const context = predict(prompt, true);
    setController(controllerFor(context));
    setTraceMessage('Measuring the first complete distribution. Selection has not committed.');
  }, [predict, prompt]);

  const continueTrace = useCallback(
    (traceId = resolvedActiveTraceId) => {
      if (!bundle || !traceId) return;
      const selected = selectCompactTrace(bundle, traceId);
      setBundle(selected);
      setActiveTraceId(traceId);
      setPreview(null);
      setForcedTokenId(null);
      setSuppressedTokenIds([]);
      const context = predict(
        effectivePrompt(selected, traceId),
        true,
        effectiveInputTokenIds(selected, traceId),
      );
      setController(controllerFor(context));
      setTraceMessage(`Measuring the next distribution for ${traceId}.`);
    },
    [bundle, predict, resolvedActiveTraceId],
  );

  useEffect(() => {
    if (!capture || !captureContext) return;
    let abandoned = false;
    if (controller.phase === 'inferring') {
      const accepted = acceptInferenceCapture(controller, captureContext);
      if (accepted === controller) return;
      queueMicrotask(() => {
        if (!abandoned) setController(accepted);
      });
    } else if (controller.phase !== 'paused-before-selection') {
      return;
    }

    void (async () => {
      try {
        let workingBundle = bundle;
        let traceId = resolvedActiveTraceId;
        if (!workingBundle) {
          traceId = nextTraceIdReference.current ?? `live-${globalThis.crypto.randomUUID()}`;
          workingBundle = createCompactLiveRoot(prompt, capture, {
            config,
            title: 'Verified live baseline',
            traceId,
          });
        }
        if (!traceId) throw new Error('Active trace identity is missing.');
        const trace = workingBundle.traces.find((item) => item.traceId === traceId);
        if (!trace) throw new Error(`Active trace ${traceId} is missing.`);
        const history = resolveCompactTraceHistory(workingBundle, traceId);
        const expectedInput = [
          ...trace.promptTokens.map((token) => token.tokenId),
          ...history.map((step) => step.sampler.selection.tokenId),
        ];
        const captureInput = capture.promptTokens.map((token) => token.tokenId);
        if (JSON.stringify(expectedInput) !== JSON.stringify(captureInput)) {
          throw new Error('Worker capture did not preserve the exact committed token prefix.');
        }
        const lastStep = history.at(-1);
        const previousSeed = lastStep?.sampler.config.seed ?? trace.rootSeed;
        const seedChanged = config.seed !== previousSeed;
        const nextPreview = await createCompactLiveStep(capture, {
          config,
          createdOrder: history.length,
          interventions,
          ...(seedChanged
            ? { seedReset: config.seed }
            : lastStep
              ? { prngStateBefore: lastStep.sampler.prngStateAfter }
              : {}),
        });
        if (abandoned) return;
        setBundle(workingBundle);
        setActiveTraceId(traceId);
        setPreview(nextPreview);
        setTraceMessage(
          `Paused before selection ${history.length + 1}. Inspect, intervene, advance or run.`,
        );
      } catch (error) {
        if (abandoned) return;
        const message = error instanceof Error ? error.message : 'Capture preparation failed.';
        setTraceMessage(message);
        setController((current) => failGeneration(current, message));
      }
    })();
    return () => {
      abandoned = true;
    };
  }, [
    bundle,
    capture,
    captureContext,
    config,
    controller,
    interventions,
    prompt,
    resolvedActiveTraceId,
  ]);

  const commitPreview = useCallback(
    (runContinuously = false) => {
      if (!bundle || !preview || !resolvedActiveTraceId) return;
      try {
        const selectedController = runContinuously ? setAutoAdvance(controller, true) : controller;
        const committing = beginGenerationCommit(selectedController);
        setController(committing);
        const committed = appendCompactGenerationStep(bundle, resolvedActiveTraceId, preview);
        const history = resolveCompactTraceHistory(committed, resolvedActiveTraceId);
        const selected = history.at(-1);
        if (!selected) throw new Error('Committed history is unexpectedly empty.');
        setBundle(committed);
        setPreview(null);
        setForcedTokenId(null);
        setSuppressedTokenIds([]);

        const termination =
          selected.sampler.selection.tokenId === EOS_TOKEN_ID
            ? 'eos'
            : history.length >= MAX_GENERATED_STEPS
              ? 'context-limit'
              : null;
        const advanced = completeGenerationCommit(committing, termination);
        if (termination) {
          setController(advanced);
          setTraceMessage(
            termination === 'eos'
              ? 'Generation completed at the model EOS token.'
              : `Generation stopped at the ${MAX_GENERATED_STEPS}-token experiment limit.`,
          );
          return;
        }

        const context = predict(
          effectivePrompt(committed, resolvedActiveTraceId),
          false,
          effectiveInputTokenIds(committed, resolvedActiveTraceId),
        );
        if (
          advanced.phase !== 'inferring' ||
          !advanced.pending ||
          !sameGenerationRequest(advanced.pending, context)
        ) {
          throw new Error('Worker request identity diverged from the generation controller.');
        }
        setController(advanced);
        setTraceMessage(
          `Committed ${visibleToken(selected.sampler.selection.text, selected.sampler.selection.tokenId)}; measuring the next exact prefix.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Step commitment failed.';
        setTraceMessage(message);
        setController((current) => failGeneration(current, message));
      }
    },
    [bundle, controller, predict, preview, resolvedActiveTraceId],
  );

  useEffect(() => {
    if (controller.phase !== 'paused-before-selection' || !controller.autoAdvance || !preview)
      return;
    const timeout = globalThis.setTimeout(() => commitPreview(true), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [commitPreview, controller, preview]);

  const pause = () => {
    setController((current) => setAutoAdvance(current, false));
    setTraceMessage('Continuous run will pause on the next complete distribution.');
  };

  const stopRun = () => {
    stop();
    setController((current) => stopGeneration(current));
    setTraceMessage('Generation stopped. The last committed trace remains immutable.');
  };

  const selectTrace = (traceId: string) => {
    if (!bundle) return;
    stop();
    setBundle(selectCompactTrace(bundle, traceId));
    setActiveTraceId(traceId);
    setPreview(null);
    setForcedTokenId(null);
    setSuppressedTokenIds([]);
    setController(createGenerationControllerState(controller.workerEpoch));
    setTraceMessage(`Selected ${traceId}. Continue it to measure a fresh exact-prefix step.`);
  };

  const toggleSuppression = (tokenId: number) => {
    setForcedTokenId((current) => (current === tokenId ? null : current));
    setSuppressedTokenIds((current) =>
      current.includes(tokenId)
        ? current.filter((item) => item !== tokenId)
        : [...current, tokenId],
    );
  };

  const forceToken = (tokenId: number | null) => {
    setForcedTokenId(tokenId);
    if (tokenId !== null) {
      setSuppressedTokenIds((current) => current.filter((item) => item !== tokenId));
    }
  };

  const forkHistoricalRunnerUp = async () => {
    if (!bundle || !baselineTraceId) return;
    try {
      const baselineHistory = resolveCompactTraceHistory(bundle, baselineTraceId);
      const source = baselineHistory[forkStep];
      if (!source) throw new Error('Choose a committed baseline step to fork.');
      const alternative = source.decodedCandidates.find(
        (candidate) => candidate.tokenId !== source.sampler.selection.tokenId,
      );
      if (!alternative) throw new Error('No decoded alternative is available at this step.');
      const childId = `branch-${globalThis.crypto.randomUUID()}`;
      let childBundle = forkCompactTrace(bundle, baselineTraceId, {
        forkStep,
        title: `Prior-token intervention · step ${forkStep + 1}`,
        traceId: childId,
      });
      const childStep = await resampleCompactGenerationStep(childBundle, source, {
        createdOrder: forkStep,
        interventions: { forcedTokenId: alternative.tokenId, suppressedTokenIds: [] },
        prngStateBefore: source.sampler.prngStateBefore,
      });
      childBundle = appendCompactGenerationStep(childBundle, childId, childStep);
      childBundle = selectCompactTrace(childBundle, childId);
      stop();
      setBundle(childBundle);
      setActiveTraceId(childId);
      setPreview(null);
      setController(createGenerationControllerState(controller.workerEpoch));
      setTraceMessage(
        `Forked step ${forkStep + 1}, forced ${visibleToken(alternative.text, alternative.tokenId)} and preserved the baseline bytes.`,
      );
    } catch (error) {
      setTraceMessage(error instanceof Error ? error.message : 'Historical fork failed.');
    }
  };

  const importBundle = async (file: File) => {
    try {
      const imported = await readPortableTraceFile(file);
      assertAcceptedCompactLiveBundle(imported);
      const replay = await replayCompactTraceBundle(imported);
      if (!replay.matches) throw new Error('Imported bundle failed deterministic replay.');
      stop();
      setBundle(imported);
      setActiveTraceId(imported.rootTraceId);
      setPreview(null);
      setController(createGenerationControllerState(controller.workerEpoch));
      setTraceMessage(
        `Imported ${imported.rootTraceId}; ${replay.steps.length} effective steps replayed exactly.`,
      );
    } catch (error) {
      setTraceMessage(error instanceof Error ? error.message : 'Trace import failed.');
    }
  };

  const notebook = async () => {
    notebookReference.current ??= await IndexedDbTraceNotebook.open();
    return notebookReference.current;
  };

  const saveLocal = async () => {
    if (!bundle) return;
    try {
      const local = await notebook();
      await local.saveBundle(bundle);
      const report = await local.report();
      setNotebookReport(report);
      setTraceMessage(
        `Saved ${report.traceCount} trace${report.traceCount === 1 ? '' : 's'} with ${report.payloadCount} deduplicated payload${report.payloadCount === 1 ? '' : 's'} locally.`,
      );
    } catch (error) {
      setTraceMessage(error instanceof Error ? error.message : 'Local notebook save failed.');
    }
  };

  const restoreLatest = async () => {
    try {
      const local = await notebook();
      const latest = (await local.listTraces())[0];
      if (!latest) throw new Error('The local notebook is empty.');
      const restored = await local.exportBundle(latest.traceId);
      assertAcceptedCompactLiveBundle(restored);
      setBundle(restored);
      setActiveTraceId(restored.rootTraceId);
      setPreview(null);
      setNotebookReport(await local.report());
      setTraceMessage(`Restored ${latest.title} from the local notebook.`);
    } catch (error) {
      setTraceMessage(error instanceof Error ? error.message : 'Notebook restore failed.');
    }
  };

  useEffect(
    () => () => {
      notebookReference.current?.close();
    },
    [],
  );

  return (
    <section aria-labelledby="live-model-title" className="live-model instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Verified local instrument · Phase 4</p>
          <h2 id="live-model-title">Multi-step DistilGPT2 observatory</h2>
          <p>
            Exact token specimens, content-addressed logits and a serialised PRNG cursor carry a
            baseline or counterfactual future through pause, intervention, evidence-gated
            observation, replay and local persistence.
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
          <span>WASM fp32</span>
          <strong>golden verified</strong>
        </div>
        <div>
          <span>Trace</span>
          <strong>schema 1.2 compact</strong>
        </div>
        <div>
          <span>Limit</span>
          <strong>{MAX_GENERATED_STEPS} generated tokens</strong>
        </div>
      </div>

      <p className="integrity-callout integrity-callout--amber">
        WebGPU remains inspection-only. The rejected int8 graph is never used by this sampler.
        Accepted fp32 asset <code>{DISTILGPT2_ASSETS.wasmFp32.sha256.slice(0, 12)}</code>…
      </p>

      <CapabilityInstrumentRack capabilities={instrumentCapabilities} />

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
          Inspect with WebGPU
        </button>
        <button
          className="primary-button"
          disabled={!verifiedReady}
          onClick={startNewBaseline}
          type="button"
        >
          Start new baseline
        </button>
        <button
          className="secondary-button"
          disabled={!verifiedReady || !bundle || controller.phase === 'inferring'}
          onClick={() => continueTrace()}
          type="button"
        >
          Continue selected trace
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
      {status.state === 'predicting' && <p role="status">Running exact-prefix inference…</p>}
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
              <strong>{capture.promptTokens.length}</strong> exact input tokens
            </p>
            <p>
              <strong>{capture.candidateUniverse.captured.toLocaleString()}</strong> complete logits
            </p>
            <p>
              <strong>{capture.durationMs.toFixed(0)} ms</strong> inference
            </p>
            <p>
              <strong>{controller.phase}</strong> controller
            </p>
            {status.state === 'ready' && (
              <p>
                <strong>{cacheLabel(status.load.cacheStatus)}</strong> asset state
              </p>
            )}
          </div>
          <p className="integrity-callout integrity-callout--verified">
            Verified measured output. All {capture.candidateUniverse.size.toLocaleString()} logits
            crossed the worker boundary under {DISTILGPT2_VERIFICATION.wasmFp32.profileId}.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Token</th>
                  <th scope="col">ID</th>
                  <th scope="col">Logit</th>
                  <th scope="col">Intervene</th>
                </tr>
              </thead>
              <tbody>
                {capture.candidates.slice(0, 10).map((candidate, index) => (
                  <tr key={candidate.tokenId}>
                    <td>{index + 1}</td>
                    <th scope="row">{visibleToken(candidate.text, candidate.tokenId)}</th>
                    <td>{candidate.tokenId}</td>
                    <td>{candidate.logit.toFixed(4)}</td>
                    <td>
                      <button
                        aria-pressed={forcedTokenId === candidate.tokenId}
                        className="text-button"
                        onClick={() =>
                          forceToken(forcedTokenId === candidate.tokenId ? null : candidate.tokenId)
                        }
                        type="button"
                      >
                        Force
                      </button>{' '}
                      <button
                        aria-pressed={suppressedTokenIds.includes(candidate.tokenId)}
                        className="text-button"
                        onClick={() => toggleSuppression(candidate.tokenId)}
                        type="button"
                      >
                        Suppress
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TokenSpecimenBench
        capability={tokenCapability}
        generated={activeHistory.map((step) => step.sampler.selection)}
        pending={preview?.step.sampler.selection ?? null}
        promptTokens={activeTrace?.promptTokens ?? capture?.promptTokens ?? []}
        traceLabel={activeTrace?.title ?? (capture ? 'measured prefix' : 'awaiting trace')}
      />

      <section aria-labelledby="generation-controls-title" className="trace-dock generation-dock">
        <div className="trace-dock__heading">
          <div>
            <p className="eyebrow">Generation controller</p>
            <h3 id="generation-controls-title">Pause, intervene and advance</h3>
          </div>
          <strong>{controller.phase}</strong>
        </div>
        <div className="generation-settings">
          <label>
            Mode
            <select
              disabled={controller.phase !== 'paused-before-selection'}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  mode: event.currentTarget.value as SamplerConfig['mode'],
                }))
              }
              value={config.mode}
            >
              <option value="sampled">Seeded sample</option>
              <option value="greedy">Greedy</option>
            </select>
          </label>
          <label>
            Seed / explicit reset
            <input
              disabled={controller.phase !== 'paused-before-selection'}
              onChange={(event) =>
                setConfig((current) => ({ ...current, seed: event.currentTarget.value }))
              }
              value={config.seed}
            />
          </label>
        </div>
        <div className="live-model__actions live-model__actions--trace">
          <button
            className="primary-button"
            disabled={!preview || controller.phase !== 'paused-before-selection'}
            onClick={() => void commitPreview(false)}
            type="button"
          >
            Advance one token
          </button>
          <button
            className="secondary-button"
            disabled={!preview || controller.phase !== 'paused-before-selection'}
            onClick={() => void commitPreview(true)}
            type="button"
          >
            Run continuously
          </button>
          <button
            className="secondary-button"
            disabled={!controller.autoAdvance}
            onClick={pause}
            type="button"
          >
            Pause on next distribution
          </button>
          <button
            className="secondary-button"
            disabled={controller.phase === 'idle' || controller.phase === 'complete'}
            onClick={stopRun}
            type="button"
          >
            Stop
          </button>
        </div>
        {preview && (
          <p className="trace-dock__status">
            Pending selection:{' '}
            <strong>
              {visibleToken(
                preview.step.sampler.selection.text,
                preview.step.sampler.selection.tokenId,
              )}
            </strong>{' '}
            · cursor {preview.step.sampler.prngStateBefore.join(':')} →{' '}
            {preview.step.sampler.prngStateAfter.join(':')}
          </p>
        )}
      </section>

      <section aria-labelledby="branch-dag-title" className="trace-dock">
        <div className="trace-dock__heading">
          <div>
            <p className="eyebrow">Branch DAG · immutable ancestry</p>
            <h3 id="branch-dag-title">Fork any committed baseline step</h3>
          </div>
          <strong>{bundle?.traces.length ?? 0} traces</strong>
        </div>
        {bundle && (
          <div className="trace-list" role="list" aria-label="Trace tips">
            {bundle.traces.map((trace) => (
              <button
                aria-pressed={resolvedActiveTraceId === trace.traceId}
                className="branch-card"
                key={trace.traceId}
                onClick={() => selectTrace(trace.traceId)}
                role="listitem"
                type="button"
              >
                <strong>{trace.title}</strong>
                <span>
                  {resolveCompactTraceHistory(bundle, trace.traceId).length} effective steps
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="live-model__actions live-model__actions--trace">
          <label>
            Historical baseline step
            <select
              disabled={!bundle || !baselineTraceId || activeHistory.length === 0}
              onChange={(event) => setForkStep(Number(event.currentTarget.value))}
              value={forkStep}
            >
              {(bundle && baselineTraceId
                ? resolveCompactTraceHistory(bundle, baselineTraceId)
                : []
              ).map((step, index) => (
                <option key={step.createdOrder} value={index}>
                  {index + 1} ·{' '}
                  {visibleToken(step.sampler.selection.text, step.sampler.selection.tokenId)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button"
            disabled={!bundle || !baselineTraceId}
            onClick={() => void forkHistoricalRunnerUp()}
            type="button"
          >
            Fork decoded alternative
          </button>
        </div>
        {comparison && (
          <p className="trace-dock__status">
            {comparison.firstDivergenceStep === null
              ? `No selection divergence across ${comparison.sharedSteps} shared steps.`
              : `First selection divergence: step ${comparison.firstDivergenceStep + 1}.`}
          </p>
        )}
      </section>

      <section aria-labelledby="portable-trace-title" className="trace-dock">
        <div className="trace-dock__heading">
          <div>
            <p className="eyebrow">Portable trace bundle · schema 1.2</p>
            <h3 id="portable-trace-title">Replay, export and local notebook</h3>
          </div>
          <strong>{bundle ? 'Content addressed' : 'Awaiting trace'}</strong>
        </div>
        <div className="live-model__actions live-model__actions--trace">
          <label className="secondary-button trace-file-button">
            Import 1.0 / 1.1 / 1.2
            <input
              accept=".json,application/json"
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (file) void importBundle(file).finally(() => (input.value = ''));
              }}
              type="file"
            />
          </label>
          <button
            className="secondary-button"
            disabled={!bundle}
            onClick={() => bundle && downloadPortableTrace(bundle)}
            type="button"
          >
            Export ancestry bundle
          </button>
          <button
            className="secondary-button"
            disabled={!bundle || !capabilities.indexedDb}
            onClick={() => void saveLocal()}
            type="button"
          >
            Save to local notebook
          </button>
          <button
            className="secondary-button"
            disabled={!capabilities.indexedDb}
            onClick={() => void restoreLatest()}
            type="button"
          >
            Restore most recent
          </button>
        </div>
        <p aria-live="polite" className="trace-dock__status">
          {traceMessage}
        </p>
        {bundle && bundleBytes !== null && (
          <dl className="trace-dock__readout">
            <div>
              <dt>Effective steps</dt>
              <dd>{activeHistory.length}</dd>
            </div>
            <div>
              <dt>Payloads</dt>
              <dd>{Object.keys(bundle.payloads).length}</dd>
            </div>
            <div>
              <dt>Portable JSON</dt>
              <dd>{(bundleBytes / 1024).toFixed(1)} KiB</dd>
            </div>
            <div>
              <dt>Notebook</dt>
              <dd>
                {notebookReport
                  ? `${notebookReport.traceCount} traces · ${(notebookReport.approximateBytes / 1024).toFixed(1)} KiB`
                  : 'not inspected'}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <LiveExperimentNotebook
        activeAnnotations={activeTrace?.annotations ?? []}
        activeTraceTitle={activeTrace?.title ?? null}
        observations={experimentObservations}
        onAppend={appendExperimentReflection}
      />

      <p className="instrument-note">
        The accepted fp32 graph is 327.8 MB. Initial correctness reruns the exact full prefix; no
        KV-cache speed-up is claimed. Parent deletion is prevented while descendants exist, and a
        failed quota transaction leaves earlier notebook records intact.
      </p>
    </section>
  );
}
