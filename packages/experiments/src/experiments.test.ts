import { describe, expect, it } from 'vitest';

import { findExperiment, GUIDED_EXPERIMENTS } from './index';

describe('guided experiment registry', () => {
  it('contains eight uniquely identified, integrity-bounded experiments', () => {
    expect(GUIDED_EXPERIMENTS).toHaveLength(8);
    expect(new Set(GUIDED_EXPERIMENTS.map((experiment) => experiment.id)).size).toBe(8);
    expect(GUIDED_EXPERIMENTS.every((experiment) => experiment.limitation.length > 20)).toBe(true);
  });

  it('finds an experiment by stable identifier', () => {
    expect(findExperiment('force-runner-up')?.title).toBe('Force the runner-up');
    expect(findExperiment('missing')).toBeUndefined();
  });
});
