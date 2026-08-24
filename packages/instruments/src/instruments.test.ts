import { describe, expect, it } from 'vitest';

import type { ExperimentTrace, GenerationStep } from '@observatory/domain';
import { runSampler } from '@observatory/sampler';

import {
  buildProbabilityRows,
  compareBranches,
  explainSelection,
  jensenShannonDivergenceBits,
} from './index';

const rawCandidates = [
  { logit: 2, text: ' clear', tokenId: 1 },
  { logit: 1, text: ' dark', tokenId: 2 },
];

function makeStep(force: number | null = null): GenerationStep {
  return {
    candidateUniverse: { captured: 2, complete: true, label: 'fixture', size: 2 },
    createdOrder: 0,
    inference: {
      durationMs: null,
      evidenceClass: 'derived',
      logitsSha256: null,
      mode: 'illustrative-demo',
      note: 'Fixture',
      verificationProfileId: null,
      verificationStatus: 'illustrative',
    },
    inputTokenIds: [10],
    position: 1,
    sampler: runSampler(
      rawCandidates,
      { mode: 'greedy', seed: 'fixture', temperature: 1, topK: null, topP: 1 },
      { forcedTokenId: force, suppressedTokenIds: [] },
    ),
  };
}

function makeTrace(id: string, step: GenerationStep, dtype = 'fixture'): ExperimentTrace {
  return {
    annotations: [],
    calculationVersions: { entropy: 'bits-1', sampler: '1', softmax: 'stable-1' },
    createdAt: '2026-08-24T00:00:00.000Z',
    mode: 'illustrative-demo',
    model: {
      assetHash: null,
      dtype,
      id: 'fixture',
      revision: '1',
      runtime: 'test',
      verificationStatus: 'illustrative',
    },
    parent: null,
    prompt: 'The night sky was',
    promptTokens: [{ byteValues: [84], position: 0, text: 'The', tokenId: 10 }],
    schemaVersion: '1.1.0',
    steps: [step],
    title: id,
    tokenizer: { assetHash: null, id: 'fixture', revision: '1' },
    traceId: id,
  };
}

describe('probability instruments', () => {
  it('builds rows with selection and exact values', () => {
    const rows = buildProbabilityRows(makeStep());
    expect(rows[0]).toMatchObject({ rank: 1, selected: true, tokenId: 1 });
    expect(rows[1]).toMatchObject({ rank: 2, selected: false, tokenId: 2 });
  });

  it('returns zero Jensen-Shannon divergence for identical distributions', () => {
    const step = makeStep();
    expect(
      jensenShannonDivergenceBits(step.sampler.candidates, step.sampler.candidates),
    ).toBeCloseTo(0, 12);
  });

  it('compares compatible branches and detects selection divergence', () => {
    const baseline = makeTrace('baseline', makeStep());
    const branch = makeTrace('branch', makeStep(2));
    expect(compareBranches(baseline, branch)).toMatchObject({
      compatible: true,
      firstDivergenceStep: 0,
      selectedTokenChanged: true,
    });
  });

  it('refuses comparisons across incompatible model builds', () => {
    const baseline = makeTrace('baseline', makeStep());
    const other = makeTrace('other', makeStep(), 'q8');
    expect(compareBranches(baseline, other)).toMatchObject({ compatible: false });
  });

  it('explains both mechanical and forced selections', () => {
    const greedyExplanation = explainSelection(makeStep());
    expect(greedyExplanation.selectionRule).toContain('Greedy');
    expect(greedyExplanation.transformedLogit).toBe(
      '2.000 raw logit; greedy mode does not apply temperature.',
    );
    expect(explainSelection(makeStep(2))).toMatchObject({
      draw: 'No pseudo-random draw was used.',
      selectionRule: 'A recorded manual intervention forced this candidate.',
    });
  });
});
