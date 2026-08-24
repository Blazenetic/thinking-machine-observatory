import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { InferenceStatus, PredictionCapture } from '@observatory/domain';
import {
  detectRuntimeCapabilities,
  type InferenceWorkerRequest,
  type InferenceWorkerResponse,
  type LiveBackend,
} from '@observatory/inference-worker';

function requestId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function useLiveInference() {
  const capabilities = useMemo(() => detectRuntimeCapabilities(), []);
  const workerReference = useRef<Worker | null>(null);
  const [status, setStatus] = useState<InferenceStatus>({ state: 'idle' });
  const [capture, setCapture] = useState<PredictionCapture | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerReference.current) return workerReference.current;
    const worker = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), {
      name: 'observatory-inference',
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<InferenceWorkerResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        setStatus({
          message: response.progress.message,
          progress: response.progress.progress,
          state: 'loading',
        });
      } else if (response.type === 'ready') {
        setStatus({ model: response.model, state: 'ready' });
      } else if (response.type === 'prediction') {
        setCapture(response.capture);
        setStatus({ model: response.capture.model, state: 'ready' });
      } else if (response.type === 'disposed') {
        setStatus({ state: 'idle' });
      } else {
        setStatus({ message: response.message, state: 'error' });
      }
    });
    worker.addEventListener('error', (event) => {
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

  const load = useCallback(
    (backend: LiveBackend) => {
      setCapture(null);
      setStatus({ message: 'Preparing model loader', progress: 0, state: 'loading' });
      post({ backend, id: requestId('load'), type: 'load' });
    },
    [post],
  );

  const predict = useCallback(
    (prompt: string) => {
      setStatus({ state: 'predicting' });
      post({ id: requestId('predict'), prompt, topN: 20, type: 'predict' });
    },
    [post],
  );

  const cancel = useCallback(() => {
    workerReference.current?.terminate();
    workerReference.current = null;
    setCapture(null);
    setStatus({ state: 'idle' });
  }, []);

  useEffect(
    () => () => {
      if (workerReference.current) {
        workerReference.current.postMessage({ id: requestId('dispose'), type: 'dispose' });
        workerReference.current.terminate();
      }
    },
    [],
  );

  return { cancel, capabilities, capture, load, predict, status };
}
