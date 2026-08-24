import { describe, expect, it } from 'vitest';

import {
  evaluateExperiment,
  findExperiment,
  formatExperimentReflection,
  GUIDED_EXPERIMENTS,
  isExperimentReflection,
  type ExperimentObservationSnapshot,
} from './index';

const snapshot: ExperimentObservationSnapshot = {
  attentionInterventions: 0,
  capabilities: {
    attention: 'unavailable',
    'logit-lens': 'unavailable',
    'token-specimens': 'verified',
  },
  distinctPrompts: 1,
  distinctSeeds: 3,
  distinctTemperatures: 3,
  distinctTopP: 1,
  forcedSelections: 1,
  probeSweeps: 0,
  tokenSpecimens: 4,
  whitespaceBoundaries: 3,
};

describe('guided experiment registry', () => {
  it('contains eight uniquely identified, integrity-bounded experiments', () => {
    expect(GUIDED_EXPERIMENTS).toHaveLength(8);
    expect(new Set(GUIDED_EXPERIMENTS.map((experiment) => experiment.id)).size).toBe(8);
    expect(GUIDED_EXPERIMENTS.every((experiment) => experiment.limitation.length > 20)).toBe(true);
    expect(GUIDED_EXPERIMENTS.every((experiment) => experiment.protocolVersion === '1')).toBe(true);
    expect(GUIDED_EXPERIMENTS.every((experiment) => experiment.predicates.length > 0)).toBe(true);
  });

  it('finds an experiment by stable identifier', () => {
    expect(findExperiment('force-runner-up')?.title).toBe('Force the runner-up');
    expect(findExperiment('missing')).toBeUndefined();
  });

  it('evaluates observations rather than completion clicks', () => {
    expect(evaluateExperiment(findExperiment('force-runner-up')!, snapshot)).toMatchObject({
      complete: true,
      status: 'observed',
    });
    expect(evaluateExperiment(findExperiment('nucleus-boundary')!, snapshot)).toMatchObject({
      complete: false,
      status: 'pending',
    });
    expect(
      evaluateExperiment(findExperiment('attention-is-not-importance')!, snapshot),
    ).toMatchObject({ complete: false, status: 'blocked' });
  });

  it('formats recognisable append-only reflection notes', () => {
    const note = formatExperimentReflection({
      experimentId: 'force-runner-up',
      experimentVersion: '1',
      observationStatus: 'observed',
      reflection: '  The manual override changed the future. ',
    });
    expect(note).toContain('force-runner-up@1 observed: The manual override changed the future.');
    expect(isExperimentReflection(note)).toBe(true);
    expect(isExperimentReflection(note, 'force-runner-up')).toBe(true);
    expect(isExperimentReflection(note, 'nucleus-boundary')).toBe(false);
    expect(() =>
      formatExperimentReflection({
        experimentId: 'force-runner-up',
        experimentVersion: '1',
        observationStatus: 'pending',
        reflection: '   ',
      }),
    ).toThrow('must not be empty');
  });
});
