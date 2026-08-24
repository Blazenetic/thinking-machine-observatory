import { describe, expect, it } from 'vitest';

import type { RawCandidate, SamplerConfig } from '@observatory/domain';

import {
  entropyBits,
  runSampler,
  SamplerConfigurationError,
  seedToState,
  stableSoftmax,
  Xoshiro128StarStar,
} from './index';

const candidates: readonly RawCandidate[] = [
  { logit: 3, text: ' alpha', tokenId: 1 },
  { logit: 2, text: ' beta', tokenId: 2 },
  { logit: 1, text: ' gamma', tokenId: 3 },
  { logit: 0, text: ' delta', tokenId: 4 },
];

const sampledConfig: SamplerConfig = {
  mode: 'sampled',
  seed: 'fixture',
  temperature: 1,
  topK: null,
  topP: 1,
};

describe('stableSoftmax', () => {
  it('remains finite for large logits and sums to one', () => {
    const result = stableSoftmax([10_000, 10_000, 9_999]);
    expect(result.every(Number.isFinite)).toBe(true);
    expect(result.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    expect(result[0]).toBeCloseTo(result[1] as number, 12);
  });

  it('rejects empty and non-finite inputs', () => {
    expect(() => stableSoftmax([])).toThrow(SamplerConfigurationError);
    expect(() => stableSoftmax([0, Number.POSITIVE_INFINITY])).toThrow(SamplerConfigurationError);
  });
});

describe('entropyBits', () => {
  it('matches known distributions and handles zero mass', () => {
    expect(entropyBits([0.5, 0.5])).toBeCloseTo(1, 12);
    expect(entropyBits([1, 0])).toBe(0);
  });
});

describe('seeded PRNG', () => {
  it('has stable state and sequence for a known seed', () => {
    expect(seedToState('observatory')).toEqual([
      2_470_906_846, 2_491_680_276, 1_779_270_576, 1_842_253_434,
    ]);
    const generator = new Xoshiro128StarStar('observatory');
    expect([generator.nextUint32(), generator.nextUint32(), generator.nextUint32()]).toEqual([
      2_592_654_859, 2_810_558_882, 3_217_223_080,
    ]);
  });
});

describe('runSampler', () => {
  it('records the identity transform at temperature one', () => {
    const result = runSampler(candidates, sampledConfig);
    expect(result.candidates.map((candidate) => candidate.temperatureScaledLogit)).toEqual([
      3, 2, 1, 0,
    ]);
    expect(
      result.candidates.reduce((sum, candidate) => sum + candidate.finalProbability, 0),
    ).toBeCloseTo(1, 12);
  });

  it('sharpens at low temperature and flattens at high temperature', () => {
    const low = runSampler(candidates, { ...sampledConfig, temperature: 0.5 });
    const high = runSampler(candidates, { ...sampledConfig, temperature: 2 });
    expect(low.candidates[0]?.finalProbability).toBeGreaterThan(
      high.candidates[0]?.finalProbability as number,
    );
    expect(low.entropyBits).toBeLessThan(high.entropyBits);
  });

  it('applies top-k with stable input ordering for ties', () => {
    const tied = [
      { logit: 1, text: ' first', tokenId: 20 },
      { logit: 1, text: ' second', tokenId: 10 },
      { logit: 0, text: ' third', tokenId: 30 },
    ];
    const result = runSampler(tied, { ...sampledConfig, topK: 1 });
    expect(result.selection.tokenId).toBe(20);
    expect(result.candidates[1]?.eliminationReason).toBe('top-k');
  });

  it('includes the candidate that crosses the top-p boundary and renormalises', () => {
    const result = runSampler(candidates, { ...sampledConfig, topP: 0.8 });
    const retained = result.candidates.filter((candidate) => candidate.retainedByTopP);
    expect(retained).toHaveLength(2);
    expect(retained.reduce((sum, candidate) => sum + candidate.finalProbability, 0)).toBeCloseTo(
      1,
      12,
    );
    expect(result.candidates[2]?.eliminationReason).toBe('top-p');
  });

  it('records suppression before the filters', () => {
    const result = runSampler(candidates, sampledConfig, {
      forcedTokenId: null,
      suppressedTokenIds: [1],
    });
    expect(result.candidates[0]).toMatchObject({
      eliminationReason: 'suppressed',
      finalProbability: 0,
      temperatureScaledLogit: null,
    });
    expect(result.candidates[1]?.rawRank).toBe(2);
  });

  it('can force a candidate removed by top-k without rewriting its probability', () => {
    const result = runSampler(
      candidates,
      { ...sampledConfig, topK: 1 },
      { forcedTokenId: 3, suppressedTokenIds: [] },
    );
    expect(result.selection).toMatchObject({
      mode: 'forced',
      probability: 0,
      tokenId: 3,
    });
    expect(result.candidates.find((candidate) => candidate.tokenId === 3)?.eliminationReason).toBe(
      'top-k',
    );
  });

  it('uses argmax without a random draw in greedy mode', () => {
    const result = runSampler(candidates, { ...sampledConfig, mode: 'greedy' });
    expect(result.selection).toMatchObject({ draw: null, mode: 'greedy', tokenId: 1 });
  });

  it('replays the same selection and interval for the same seed', () => {
    const first = runSampler(candidates, sampledConfig);
    const replay = runSampler(candidates, sampledConfig);
    expect(replay.selection).toEqual(first.selection);
  });

  it('continues from an explicit recorded cursor without re-seeding', () => {
    const first = runSampler(candidates, sampledConfig);
    const cursor = first.selection.draw?.stateAfter;
    if (!cursor) throw new Error('Expected a sampled draw.');

    const second = runSampler(candidates, sampledConfig, undefined, cursor);
    const reSeeded = runSampler(candidates, sampledConfig);

    expect(second.selection.draw?.stateBefore).toEqual(cursor);
    expect(second.selection.draw?.value).not.toBe(reSeeded.selection.draw?.value);
    expect(runSampler(candidates, sampledConfig, undefined, cursor).selection).toEqual(
      second.selection,
    );
  });

  it('rejects malformed explicit cursors before sampling', () => {
    expect(() => runSampler(candidates, sampledConfig, undefined, [0, 0, 0, 0])).toThrow(
      SamplerConfigurationError,
    );
    expect(() => runSampler(candidates, sampledConfig, undefined, [1, 2, 3, -1])).toThrow(
      SamplerConfigurationError,
    );
  });

  it('rejects invalid or contradictory inputs', () => {
    expect(() => runSampler(candidates, { ...sampledConfig, temperature: 0 })).toThrow(
      SamplerConfigurationError,
    );
    expect(() => runSampler(candidates, { ...sampledConfig, topP: 1.1 })).toThrow(
      SamplerConfigurationError,
    );
    expect(() =>
      runSampler(candidates, sampledConfig, { forcedTokenId: 1, suppressedTokenIds: [1] }),
    ).toThrow(SamplerConfigurationError);
  });
});
