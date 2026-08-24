import { describe, expect, it } from 'vitest';

import {
  createInferenceWorkerHandler,
  detectRuntimeCapabilities,
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_VERIFICATION,
  extractFinalLogits,
  instrumentCapabilitiesForModel,
  rankTopCandidates,
  type InferenceAdapter,
  type InferenceWorkerResponse,
} from './index';

describe('inference boundary', () => {
  it('pins the experimental model revision', () => {
    expect(DISTILGPT2_MODEL.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(DISTILGPT2_ASSETS.wasmFp32.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(DISTILGPT2_ASSETS.tokenizerBundle.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(DISTILGPT2_VERIFICATION.wasmFp32.status).toBe('accepted');
    expect(DISTILGPT2_VERIFICATION.wasmInt8.status).toBe('rejected');
  });

  it('declares verified token specimens and zero-allocation unavailable instruments', () => {
    const model = {
      assetHash: `sha256:${DISTILGPT2_ASSETS.wasmFp32.sha256}`,
      dtype: 'fp32',
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
      runtime: 'fixture',
      verificationStatus: 'verified',
    } as const;
    const tokenizer = {
      assetHash: `sha256:${DISTILGPT2_ASSETS.tokenizerBundle.sha256}`,
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
    } as const;
    const capabilities = instrumentCapabilitiesForModel(model, tokenizer);

    expect(capabilities.find((item) => item.id === 'token-specimens')).toMatchObject({
      evidenceClass: 'measured',
      status: 'verified',
    });
    expect(
      capabilities
        .filter((item) => item.id !== 'token-specimens')
        .every((item) => item.status === 'unavailable' && item.limits.maxCapturedBytes === 0),
    ).toBe(true);

    expect(
      instrumentCapabilitiesForModel(model, {
        ...tokenizer,
        assetHash: `sha256:${'0'.repeat(64)}`,
      }).find((item) => item.id === 'token-specimens'),
    ).toMatchObject({ profileId: null, status: 'unverified' });
  });

  it('detects capabilities without assuming browser globals', () => {
    expect(
      detectRuntimeCapabilities({
        Worker: class Worker {},
        indexedDB: {},
        isSecureContext: true,
        navigator: { gpu: {} },
      }),
    ).toEqual({ indexedDb: true, secureContext: true, webGpu: true, webWorker: true });
    expect(detectRuntimeCapabilities({ navigator: {} })).toEqual({
      indexedDb: false,
      secureContext: false,
      webGpu: false,
      webWorker: false,
    });
  });

  it('extracts the complete final-position logit vector', () => {
    expect(
      extractFinalLogits({
        data: new Float32Array([10, 11, 12, 20, 21, 22]),
        dims: [1, 2, 3],
      }),
    ).toEqual(new Float32Array([20, 21, 22]));
    expect(() => extractFinalLogits({ data: [], dims: [0] })).toThrow('Unexpected logits shape');
    expect(() => extractFinalLogits({ data: [1, 2], dims: [1, 2, 2] })).toThrow(
      'declares 4 values',
    );
    expect(() =>
      extractFinalLogits({ data: [1, 2, 3, 4, 5, Number.NaN], dims: [1, 2, 3] }),
    ).toThrow('not finite');
    expect(() => extractFinalLogits({ data: new Float32Array(12), dims: [2, 2, 3] })).toThrow(
      'one logits batch',
    );
  });

  it('ranks only the requested display candidates with stable token-ID ties', () => {
    expect(rankTopCandidates(new Float32Array([2, 4, 4, Number.NaN, 1]), 3)).toEqual([
      { logit: 4, text: '', tokenId: 1 },
      { logit: 4, text: '', tokenId: 2 },
      { logit: 2, text: '', tokenId: 0 },
    ]);
    expect(() => rankTopCandidates(new Float32Array([1]), 0)).toThrow('positive integer');
  });

  it('echoes generation, request and epoch identity across the worker protocol', async () => {
    const responses: InferenceWorkerResponse[] = [];
    const model = {
      assetHash: null,
      dtype: 'fixture',
      id: 'fixture',
      revision: '1',
      runtime: 'vitest',
      verificationStatus: 'illustrative',
    } as const;
    const adapter: InferenceAdapter = {
      dispose: () => Promise.resolve(),
      instrumentCapabilities: instrumentCapabilitiesForModel(model, {
        assetHash: null,
        id: 'fixture',
        revision: '1',
      }),
      load: (onProgress) => {
        onProgress?.({
          loadedBytes: 5,
          message: 'fixture progress',
          progress: 50,
          totalBytes: 10,
        });
        return Promise.resolve({
          cacheStatus: 'warm-cache',
          durationMs: 1,
          modelAssetBytes: 10,
        });
      },
      modelIdentity: model,
      predict: () =>
        Promise.resolve({
          candidateUniverse: { captured: 2, complete: true, label: 'fixture', size: 2 },
          candidates: [
            { logit: 2, text: ' a', tokenId: 0 },
            { logit: 1, text: ' b', tokenId: 1 },
          ],
          durationMs: 1,
          logits: new Float32Array([2, 1]),
          logitsSha256: '0'.repeat(64),
          mode: 'live-wasm',
          model,
          promptTokens: [{ byteValues: [65], position: 0, text: 'A', tokenId: 32 }],
          tokenizer: { assetHash: null, id: 'fixture', revision: '1' },
          verificationProfileId: null,
        }),
    };
    const handler = createInferenceWorkerHandler(
      (response) => responses.push(response),
      () => adapter,
    );
    const context = { generationId: 'generation-a', requestOrder: 2, workerEpoch: 3 };

    await handler({ backend: 'wasm', context, id: 'load-a', type: 'load' });
    await handler({ context, id: 'predict-a', prompt: 'A', topN: 2, type: 'predict' });
    await handler({ context, id: 'dispose-a', type: 'dispose' });

    expect(responses.map((response) => response.context)).toEqual([
      context,
      context,
      context,
      context,
    ]);
    expect(responses.map((response) => response.type)).toEqual([
      'progress',
      'ready',
      'prediction',
      'disposed',
    ]);
    const ready = responses.find((response) => response.type === 'ready');
    expect(ready?.type).toBe('ready');
    if (ready?.type !== 'ready') throw new Error('Expected a ready response.');
    expect(ready.instrumentCapabilities).toHaveLength(5);
  });
});
