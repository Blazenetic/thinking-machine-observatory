import { describe, expect, it } from 'vitest';

import {
  detectRuntimeCapabilities,
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_VERIFICATION,
  extractFinalLogits,
  rankTopCandidates,
} from './index';

describe('inference boundary', () => {
  it('pins the experimental model revision', () => {
    expect(DISTILGPT2_MODEL.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(DISTILGPT2_ASSETS.wasmFp32.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(DISTILGPT2_ASSETS.tokenizerBundle.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(DISTILGPT2_VERIFICATION.wasmFp32.status).toBe('accepted');
    expect(DISTILGPT2_VERIFICATION.wasmInt8.status).toBe('rejected');
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
  });

  it('ranks only the requested display candidates with stable token-ID ties', () => {
    expect(rankTopCandidates(new Float32Array([2, 4, 4, Number.NaN, 1]), 3)).toEqual([
      { logit: 4, text: '', tokenId: 1 },
      { logit: 4, text: '', tokenId: 2 },
      { logit: 2, text: '', tokenId: 0 },
    ]);
  });
});
