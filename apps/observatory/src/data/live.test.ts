import { describe, expect, it } from 'vitest';

import type { PredictionCapture } from '@observatory/domain';
import {
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_RUNTIME,
  DISTILGPT2_VERIFICATION,
} from '@observatory/inference-worker';
import { replayTrace, serialiseTrace } from '@observatory/trace-schema';

import { assertAcceptedLiveTrace, createLiveTrace, LiveTraceError } from './live';

function capture(status: PredictionCapture['model']['verificationStatus'] = 'verified') {
  return {
    candidateUniverse: { captured: 3, complete: true, label: 'complete fixture', size: 3 },
    candidates: [
      { logit: 2, text: ' sky', tokenId: 1 },
      { logit: 1, text: ' dark', tokenId: 2 },
      { logit: 0, text: ' clear', tokenId: 0 },
    ],
    durationMs: 12,
    logits: new Float32Array([0, 2, 1]),
    logitsSha256: 'a'.repeat(64),
    mode: 'live-wasm',
    model: {
      assetHash: `sha256:${DISTILGPT2_ASSETS.wasmFp32.sha256}`,
      dtype: 'fp32',
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
      runtime: DISTILGPT2_RUNTIME,
      verificationStatus: status,
    },
    promptTokens: [{ byteValues: [84], position: 0, text: 'T', tokenId: 10 }],
    tokenizer: {
      assetHash: `sha256:${DISTILGPT2_ASSETS.tokenizerBundle.sha256}`,
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
    },
    verificationProfileId:
      status === 'verified' ? DISTILGPT2_VERIFICATION.wasmFp32.profileId : null,
  } satisfies PredictionCapture;
}

describe('verified live trace', () => {
  it('samples the complete vector and round-trips through exact replay', () => {
    const trace = createLiveTrace('T', capture(), {
      createdAt: '2026-08-24T04:00:00.000Z',
      traceId: 'live-fixture',
    });
    expect(trace.steps[0]?.sampler.candidates).toHaveLength(3);
    expect(trace.steps[0]?.inference).toMatchObject({
      logitsSha256: 'a'.repeat(64),
      verificationProfileId: DISTILGPT2_VERIFICATION.wasmFp32.profileId,
      verificationStatus: 'verified',
    });
    expect(replayTrace(JSON.parse(serialiseTrace(trace)) as typeof trace).matches).toBe(true);
  });

  it('does not promote incomplete or unverified captures', () => {
    expect(() => createLiveTrace('T', capture('unverified'))).toThrow(LiveTraceError);
    expect(() =>
      createLiveTrace('T', {
        ...capture(),
        candidateUniverse: { captured: 2, complete: false, label: 'top two', size: 3 },
      }),
    ).toThrow('complete vocabulary');
  });

  it('does not trust a self-declared verified trace from another asset', () => {
    const trace = createLiveTrace('T', capture(), {
      createdAt: '2026-08-24T04:00:00.000Z',
      traceId: 'live-fixture',
    });
    expect(() =>
      assertAcceptedLiveTrace({
        ...trace,
        model: { ...trace.model, assetHash: `sha256:${'f'.repeat(64)}` },
      }),
    ).toThrow('does not match');
  });
});
