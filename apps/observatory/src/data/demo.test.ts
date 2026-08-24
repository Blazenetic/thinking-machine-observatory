import { describe, expect, it } from 'vitest';

import { serialiseTrace } from '@observatory/trace-schema';

import { createBaselineTrace, createDemoBranch, DEMO_CANDIDATES, WORKBENCH_CONFIG } from './demo';

describe('demonstration vertical slice', () => {
  it('creates an immutable runner-up branch while preserving the baseline', () => {
    const baseline = createBaselineTrace();
    const before = serialiseTrace(baseline);
    const branch = createDemoBranch(baseline, {
      branchNumber: 1,
      config: WORKBENCH_CONFIG,
      interventions: {
        forcedTokenId: DEMO_CANDIDATES[1]?.tokenId ?? null,
        suppressedTokenIds: [],
      },
      title: 'Runner-up intervention',
    });

    expect(serialiseTrace(baseline)).toBe(before);
    expect(baseline.steps[0]?.sampler.selection.text).toBe(' clear');
    expect(branch.steps[0]?.sampler.selection.text).toBe(' dark');
    expect(branch.parent).toEqual({ forkStep: 1, traceId: baseline.traceId });
  });
});
