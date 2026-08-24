import { describe, expect, it } from 'vitest';

import type { PredictionCapture } from '@observatory/domain';
import {
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_RUNTIME,
  DISTILGPT2_VERIFICATION,
  DISTILGPT2_VOCABULARY_SIZE,
} from '@observatory/inference-worker';
import {
  createEmbeddedFloat32Payload,
  replayCompactTraceBundle,
  replayTrace,
  serialiseCompactTraceBundle,
  serialiseTrace,
} from '@observatory/trace-schema';

import {
  assertAcceptedLiveTrace,
  createCompactLiveTrace,
  createLiveTrace,
  LiveTraceError,
} from './live';

function capture(status: PredictionCapture['model']['verificationStatus'] = 'verified') {
  const logits = new Float32Array(DISTILGPT2_VOCABULARY_SIZE).fill(-30);
  logits[0] = 0;
  logits[1] = 2;
  logits[2] = 1;
  return {
    candidateUniverse: {
      captured: DISTILGPT2_VOCABULARY_SIZE,
      complete: true,
      label: 'complete fixture',
      size: DISTILGPT2_VOCABULARY_SIZE,
    },
    candidates: [
      { logit: 2, text: ' sky', tokenId: 1 },
      { logit: 1, text: ' dark', tokenId: 2 },
      { logit: 0, text: ' clear', tokenId: 0 },
    ],
    durationMs: 12,
    logits,
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
    expect(trace.steps[0]?.sampler.candidates).toHaveLength(DISTILGPT2_VOCABULARY_SIZE);
    expect(trace.steps[0]?.inference).toMatchObject({
      logitsSha256: 'a'.repeat(64),
      verificationProfileId: DISTILGPT2_VERIFICATION.wasmFp32.profileId,
      verificationStatus: 'verified',
    });
    expect(replayTrace(JSON.parse(serialiseTrace(trace)) as typeof trace).matches).toBe(true);
  });

  it('commits schema 1.2 without expanded candidate duplication', async () => {
    const fixture = capture();
    const payload = await createEmbeddedFloat32Payload(fixture.logits);
    const bundle = await createCompactLiveTrace(
      'T',
      { ...fixture, logitsSha256: payload.sha256 },
      {
        createdAt: '2026-08-24T04:00:00.000Z',
        traceId: 'compact-live-fixture',
      },
    );

    expect(bundle.schemaVersion).toBe('1.2.0');
    expect(Object.keys(bundle.payloads)).toEqual([payload.sha256]);
    expect(serialiseCompactTraceBundle(bundle)).not.toContain('temperatureScaledLogit');
    await expect(replayCompactTraceBundle(bundle)).resolves.toMatchObject({ matches: true });
  });

  it('does not promote incomplete or unverified captures', () => {
    expect(() => createLiveTrace('T', capture('unverified'))).toThrow(LiveTraceError);
    expect(() =>
      createLiveTrace('T', {
        ...capture(),
        candidateUniverse: { captured: 2, complete: false, label: 'top two', size: 3 },
      }),
    ).toThrow('complete vocabulary');
    expect(() =>
      createLiveTrace('T', {
        ...capture(),
        candidateUniverse: { captured: 3, complete: true, label: 'short vector', size: 3 },
        logits: new Float32Array([0, 2, 1]),
      }),
    ).toThrow(`all ${DISTILGPT2_VOCABULARY_SIZE}`);
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
