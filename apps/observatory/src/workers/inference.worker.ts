/// <reference lib="webworker" />

import {
  createInferenceWorkerHandler,
  type InferenceWorkerRequest,
} from '@observatory/inference-worker';

const workerScope = self as DedicatedWorkerGlobalScope;
const handleRequest = createInferenceWorkerHandler((response) => workerScope.postMessage(response));

workerScope.addEventListener('message', (event: MessageEvent<InferenceWorkerRequest>) => {
  void handleRequest(event.data);
});

export {};
