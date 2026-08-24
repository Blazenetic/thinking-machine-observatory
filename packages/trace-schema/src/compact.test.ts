import { describe, expect, it } from 'vitest';

import type {
  CandidateUniverse,
  InferenceProvenance,
  ModelIdentity,
  PrngState,
  RawCandidate,
  SamplerConfig,
  TokenizerIdentity,
} from '@observatory/domain';

import {
  appendCompactGenerationStep,
  appendCompactTraceAnnotation,
  CompactTraceError,
  compareCompactTraceSelections,
  createCompactGenerationStep,
  createCompactTraceBundle,
  forkCompactTrace,
  parseCompactTraceBundleJson,
  parsePortableTraceJson,
  replayCompactTraceBundle,
  resampleCompactGenerationStep,
  resolveCompactTraceHistory,
  serialiseCompactTraceBundle,
  validateCompactTraceBundle,
} from './index';

const model: ModelIdentity = {
  assetHash: null,
  dtype: 'fixture',
  id: 'compact-fixture',
  revision: '1',
  runtime: 'vitest',
  verificationStatus: 'illustrative',
};

const tokenizer: TokenizerIdentity = {
  assetHash: null,
  id: 'compact-tokenizer',
  revision: '1',
};

const universe: CandidateUniverse = {
  captured: 3,
  complete: true,
  label: 'Complete three-token fixture',
  size: 3,
};

const inference: InferenceProvenance = {
  durationMs: null,
  evidenceClass: 'derived',
  logitsSha256: null,
  mode: 'illustrative-demo',
  note: 'Exact compact test fixture.',
  verificationProfileId: null,
  verificationStatus: 'illustrative',
};

const candidates: readonly RawCandidate[] = [
  { logit: 3, text: ' alpha', tokenId: 0 },
  { logit: 2, text: ' beta', tokenId: 1 },
  { logit: 1, text: ' gamma', tokenId: 2 },
];

const config: SamplerConfig = {
  mode: 'sampled',
  seed: 'compact-seed',
  temperature: 1,
  topK: null,
  topP: 1,
};

function emptyBundle() {
  return createCompactTraceBundle({
    createdAt: '2026-08-24T00:00:00.000Z',
    mode: 'illustrative-demo',
    model,
    prompt: 'Test',
    promptTokens: [{ byteValues: [84], position: 0, text: 'Test', tokenId: 10 }],
    rootSeed: config.seed,
    title: 'Compact baseline',
    tokenizer,
    traceId: 'compact-baseline',
  });
}

async function firstStep() {
  return createCompactGenerationStep({
    candidateUniverse: universe,
    config,
    createdOrder: 0,
    inference,
    inputTokenIds: [10],
    rawCandidates: candidates,
  });
}

describe('compact schema 1.2', () => {
  it('round-trips, verifies and replays a content-addressed trace', async () => {
    const bundle = appendCompactGenerationStep(
      emptyBundle(),
      'compact-baseline',
      await firstStep(),
    );
    const restored = await parseCompactTraceBundleJson(serialiseCompactTraceBundle(bundle));

    expect(restored).toEqual(bundle);
    expect(Object.keys(restored.payloads)).toHaveLength(1);
    await expect(replayCompactTraceBundle(restored)).resolves.toMatchObject({ matches: true });
  });

  it('appends reflection annotations without mutating prior evidence', async () => {
    const original = appendCompactGenerationStep(
      emptyBundle(),
      'compact-baseline',
      await firstStep(),
    );
    const annotated = appendCompactTraceAnnotation(original, 'compact-baseline', {
      createdAt: '2026-08-24T01:00:00.000Z',
      id: 'reflection-1',
      note: '[observatory-reflection/v1] force-runner-up@1 observed: It diverged.',
      step: 0,
    });

    expect(original.traces[0]?.annotations).toEqual([]);
    expect(annotated.traces[0]?.annotations).toHaveLength(1);
    expect(annotated.traces[0]?.annotations[0]?.id).toBe('reflection-1');
    await expect(
      parseCompactTraceBundleJson(serialiseCompactTraceBundle(annotated)),
    ).resolves.toEqual(annotated);
  });

  it('continues the recorded PRNG cursor and deduplicates repeated payload bytes', async () => {
    let bundle = appendCompactGenerationStep(emptyBundle(), 'compact-baseline', await firstStep());
    const first = resolveCompactTraceHistory(bundle)[0];
    if (!first) throw new Error('Expected a first step.');
    const second = await createCompactGenerationStep({
      candidateUniverse: universe,
      config,
      createdOrder: 1,
      inference,
      inputTokenIds: [10, first.sampler.selection.tokenId],
      prngStateBefore: first.sampler.prngStateAfter,
      rawCandidates: candidates,
    });
    bundle = appendCompactGenerationStep(bundle, 'compact-baseline', second);
    const history = resolveCompactTraceHistory(bundle);

    expect(history[1]?.sampler.prngStateBefore).toEqual(history[0]?.sampler.prngStateAfter);
    expect(Object.keys(bundle.payloads)).toHaveLength(1);
  });

  it('replays five cursor-continuous steps without loading a model', async () => {
    let bundle = emptyBundle();
    let inputTokenIds = [10];
    let cursor: PrngState | null = null;
    for (let index = 0; index < 5; index += 1) {
      const compact = await createCompactGenerationStep({
        candidateUniverse: universe,
        config,
        createdOrder: index,
        inference,
        inputTokenIds,
        ...(cursor ? { prngStateBefore: cursor } : {}),
        rawCandidates: candidates,
      });
      bundle = appendCompactGenerationStep(bundle, 'compact-baseline', compact);
      cursor = compact.step.sampler.prngStateAfter;
      inputTokenIds = [...inputTokenIds, compact.step.sampler.selection.tokenId];
    }

    const history = resolveCompactTraceHistory(bundle);
    expect(history).toHaveLength(5);
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index]?.sampler.prngStateBefore).toEqual(
        history[index - 1]?.sampler.prngStateAfter,
      );
    }
    await expect(replayCompactTraceBundle(bundle)).resolves.toMatchObject({ matches: true });
  });

  it('forks a historical step, forces its runner-up and leaves the ancestor byte-stable', async () => {
    let bundle = appendCompactGenerationStep(emptyBundle(), 'compact-baseline', await firstStep());
    const ancestorBefore = serialiseCompactTraceBundle(bundle);
    const source = resolveCompactTraceHistory(bundle, 'compact-baseline')[0];
    if (!source) throw new Error('Expected a source step.');

    bundle = forkCompactTrace(bundle, 'compact-baseline', {
      createdAt: '2026-08-24T00:01:00.000Z',
      forkStep: 0,
      title: 'Forced runner-up',
      traceId: 'compact-child',
    });
    const forced = await resampleCompactGenerationStep(bundle, source, {
      createdOrder: 0,
      interventions: { forcedTokenId: 1, suppressedTokenIds: [] },
      prngStateBefore: source.sampler.prngStateBefore,
    });
    bundle = appendCompactGenerationStep(bundle, 'compact-child', forced);

    expect(compareCompactTraceSelections(bundle, 'compact-baseline', 'compact-child')).toEqual({
      firstDivergenceStep: 0,
      sharedSteps: 1,
    });
    const parsedAncestor = JSON.parse(ancestorBefore) as { readonly exportedAt: string };
    const ancestorOnly = {
      ...bundle,
      exportedAt: parsedAncestor.exportedAt,
      rootTraceId: 'compact-baseline',
      traces: bundle.traces.filter((trace) => trace.traceId === 'compact-baseline'),
    };
    expect(serialiseCompactTraceBundle(ancestorOnly)).toBe(ancestorBefore);
  });

  it('rejects missing ancestors, cyclic ancestry and tampered payloads', async () => {
    let bundle = appendCompactGenerationStep(emptyBundle(), 'compact-baseline', await firstStep());
    bundle = forkCompactTrace(bundle, 'compact-baseline', {
      forkStep: 1,
      title: 'Child',
      traceId: 'compact-child',
    });
    expect(() =>
      validateCompactTraceBundle({
        ...bundle,
        traces: bundle.traces.filter((trace) => trace.traceId === 'compact-child'),
      }),
    ).toThrow('Missing ancestor');
    expect(() =>
      validateCompactTraceBundle({
        ...bundle,
        traces: bundle.traces.map((trace) =>
          trace.traceId === 'compact-baseline'
            ? { ...trace, parent: { forkStep: 0, traceId: 'compact-child' } }
            : trace,
        ),
      }),
    ).toThrow('cycle');

    const json = JSON.parse(serialiseCompactTraceBundle(bundle)) as {
      payloads: Record<string, { data: string }>;
    };
    const payload = Object.values(json.payloads)[0];
    if (!payload) throw new Error('Expected a payload.');
    payload.data = `${payload.data.slice(0, -4)}AAAA`;
    await expect(parseCompactTraceBundleJson(JSON.stringify(json))).rejects.toThrow(
      /SHA-256|finite/,
    );
  });

  it('rejects compact steps that only claim a complete candidate universe', async () => {
    const bundle = appendCompactGenerationStep(
      emptyBundle(),
      'compact-baseline',
      await firstStep(),
    );
    const trace = bundle.traces[0];
    const step = trace?.steps[0];
    if (!trace || !step) throw new Error('Expected a compact step.');

    expect(() =>
      validateCompactTraceBundle({
        ...bundle,
        traces: [
          {
            ...trace,
            steps: [
              {
                ...step,
                candidateUniverse: { ...step.candidateUniverse, captured: 2 },
              },
            ],
          },
        ],
      }),
    ).toThrow('complete candidate universe');
  });

  it('reports bounded and contradictory construction failures', async () => {
    await expect(
      createCompactGenerationStep({
        candidateUniverse: { ...universe, complete: false },
        config,
        createdOrder: 0,
        inference,
        inputTokenIds: [10],
        rawCandidates: candidates,
      }),
    ).rejects.toBeInstanceOf(CompactTraceError);
    await expect(
      createCompactGenerationStep({
        candidateUniverse: universe,
        config,
        createdOrder: 0,
        inference,
        inputTokenIds: [10],
        prngStateBefore: [1, 2, 3, 4],
        rawCandidates: candidates,
        seedReset: 'new-seed',
      }),
    ).rejects.toThrow('mutually exclusive');
  });

  it('migrates a replayable 1.1 root without inventing inference verification', async () => {
    const legacy = {
      annotations: [],
      calculationVersions: { entropy: 'bits-1', sampler: '1', softmax: 'stable-1' },
      createdAt: '2026-08-24T00:00:00.000Z',
      mode: 'illustrative-demo',
      model,
      parent: null,
      prompt: 'Test',
      promptTokens: [{ byteValues: [84], position: 0, text: 'Test', tokenId: 10 }],
      schemaVersion: '1.1.0',
      steps: [],
      title: 'Legacy root',
      tokenizer,
      traceId: 'legacy-root',
    };
    const migrated = await parsePortableTraceJson(`${JSON.stringify(legacy)}\n`);

    expect(migrated.schemaVersion).toBe('1.2.0');
    expect(migrated.traces[0]?.steps).toEqual([]);
    expect(migrated.payloads).toEqual({});
  });
});
