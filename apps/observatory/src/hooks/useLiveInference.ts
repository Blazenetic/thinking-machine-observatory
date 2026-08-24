import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  InferenceStatus,
  ModelIdentity,
  ModelLoadReport,
  PredictionCapture,
} from '@observatory/domain';
import {
  detectRuntimeCapabilities,
  sameGenerationRequest,
  type GenerationRequestContext,
  type InferenceWorkerRequest,
  type InferenceWorkerResponse,
  type LiveBackend,
} from '@observatory/inference-worker';

function id(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function useLiveInference() {
  const capabilities = useMemo(() => detectRuntimeCapabilities(), []);
  const workerReference = useRef<Worker | null>(null);
  const workerEpochReference = useRef(0);
  const generationIdReference = useRef<string | null>(null);
  const requestOrderReference = useRef(-1);
  const activeRequestReference = useRef<GenerationRequestContext | null>(null);
  const stoppedRequestReference = useRef<GenerationRequestContext | null>(null);
  const loadReportReference = useRef<ModelLoadReport | null>(null);
  const modelReference = useRef<ModelIdentity | null>(null);
  const [status, setStatus] = useState<InferenceStatus>({ state: 'idle' });
  const [capture, setCapture] = useState<PredictionCapture | null>(null);
  const [captureContext, setCaptureContext] = useState<GenerationRequestContext | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerReference.current) return workerReference.current;
    const worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), {
      name: 'observatory-inference',
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<InferenceWorkerResponse>) => {
      const response = event.data;
      const active = activeRequestReference.current;
      const stopped = stoppedRequestReference.current;
      if (stopped && sameGenerationRequest(stopped, response.context)) {
        if (response.type === 'prediction' || response.type === 'error') {
          stoppedRequestReference.current = null;
          const load = loadReportReference.current;
          const model = modelReference.current;
          setStatus(load && model ? { load, model, state: 'ready' } : { state: 'idle' });
        }
        return;
      }
      if (!active || !sameGenerationRequest(active, response.context)) return;

      if (response.type === 'progress') {
        setStatus({
          message: response.progress.message,
          progress: response.progress.progress,
          state: 'loading',
        });
      } else if (response.type === 'ready') {
        activeRequestReference.current = null;
        loadReportReference.current = response.load;
        modelReference.current = response.model;
        setStatus({ load: response.load, model: response.model, state: 'ready' });
      } else if (response.type === 'prediction') {
        activeRequestReference.current = null;
        setCapture(response.capture);
        setCaptureContext(response.context);
        modelReference.current = response.capture.model;
        setStatus({
          load: loadReportReference.current ?? {
            cacheStatus: 'unavailable',
            durationMs: 0,
            modelAssetBytes: 0,
          },
          model: response.capture.model,
          state: 'ready',
        });
      } else if (response.type === 'disposed') {
        activeRequestReference.current = null;
        setStatus({ state: 'idle' });
      } else {
        activeRequestReference.current = null;
        setStatus({ message: response.message, state: 'error' });
      }
    });
    worker.addEventListener('error', (event) => {
      if (workerReference.current !== worker) return;
      activeRequestReference.current = null;
      setStatus({ message: event.message || 'Inference worker failed.', state: 'error' });
    });
    workerReference.current = worker;
    return worker;
  }, []);

  const post = useCallback(
    (request: InferenceWorkerRequest) => {
      ensureWorker().postMessage(request);
    },
    [ensureWorker],
  );

  const replaceWorker = useCallback(() => {
    workerReference.current?.terminate();
    workerReference.current = null;
    workerEpochReference.current += 1;
    activeRequestReference.current = null;
    stoppedRequestReference.current = null;
    generationIdReference.current = null;
    requestOrderReference.current = -1;
  }, []);

  const load = useCallback(
    (backend: LiveBackend) => {
      replaceWorker();
      loadReportReference.current = null;
      modelReference.current = null;
      setCapture(null);
      setCaptureContext(null);
      setStatus({ message: 'Preparing model loader', progress: 0, state: 'loading' });
      const context: GenerationRequestContext = {
        generationId: id('model-load'),
        requestOrder: 0,
        workerEpoch: workerEpochReference.current,
      };
      activeRequestReference.current = context;
      post({ backend, context, id: id('load'), type: 'load' });
    },
    [post, replaceWorker],
  );

  const predict = useCallback(
    (
      prompt: string,
      restartGeneration = false,
      inputTokenIds?: readonly number[],
    ): GenerationRequestContext => {
      if (restartGeneration || generationIdReference.current === null) {
        generationIdReference.current = id('generation');
        requestOrderReference.current = -1;
      }
      requestOrderReference.current += 1;
      const generationId = generationIdReference.current;
      if (generationId === null) throw new Error('Generation identity was not initialised.');
      const context: GenerationRequestContext = {
        generationId,
        requestOrder: requestOrderReference.current,
        workerEpoch: workerEpochReference.current,
      };
      activeRequestReference.current = context;
      setCapture(null);
      setCaptureContext(null);
      setStatus({ state: 'predicting' });
      post({
        context,
        id: id('predict'),
        ...(inputTokenIds ? { inputTokenIds } : {}),
        prompt,
        topN: 50,
        type: 'predict',
      });
      return context;
    },
    [post],
  );

  /** Invalidates an in-flight response while retaining the loaded model session. */
  const stop = useCallback(() => {
    stoppedRequestReference.current = activeRequestReference.current;
    activeRequestReference.current = null;
    generationIdReference.current = null;
    requestOrderReference.current = -1;
    setCaptureContext(null);
  }, []);

  const cancel = useCallback(() => {
    replaceWorker();
    loadReportReference.current = null;
    modelReference.current = null;
    setCapture(null);
    setCaptureContext(null);
    setStatus({ state: 'idle' });
  }, [replaceWorker]);

  useEffect(
    () => () => {
      workerReference.current?.terminate();
      workerReference.current = null;
    },
    [],
  );

  return {
    cancel,
    capabilities,
    capture,
    captureContext,
    load,
    predict,
    status,
    stop,
  };
}
