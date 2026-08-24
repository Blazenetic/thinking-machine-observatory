import { describe, expect, it } from 'vitest';

import {
  acceptInferenceCapture,
  beginGenerationCommit,
  cancelGeneration,
  completeGenerationCommit,
  createGenerationControllerState,
  failGeneration,
  recoverGeneration,
  setAutoAdvance,
  startGeneration,
  stopGeneration,
} from './generation-controller';

describe('generation controller', () => {
  it('advances through pause, commit and a monotonic next request', () => {
    let state = startGeneration(createGenerationControllerState(), {
      autoAdvance: true,
      generationId: 'generation-a',
      workerEpoch: 1,
    });
    const first = state.pending;
    if (!first) throw new Error('Expected a pending inference.');
    state = acceptInferenceCapture(state, first);
    expect(state.phase).toBe('paused-before-selection');
    state = beginGenerationCommit(state);
    state = completeGenerationCommit(state);

    expect(state).toMatchObject({
      autoAdvance: true,
      phase: 'inferring',
      requestOrder: 1,
    });
    expect(state.pending).toEqual({
      generationId: 'generation-a',
      requestOrder: 1,
      workerEpoch: 1,
    });
  });

  it('ignores responses from an old generation, request or worker epoch', () => {
    const active = startGeneration(createGenerationControllerState(2), {
      generationId: 'generation-current',
      workerEpoch: 2,
    });
    const stale = [
      { generationId: 'generation-old', requestOrder: 0, workerEpoch: 2 },
      { generationId: 'generation-current', requestOrder: 1, workerEpoch: 2 },
      { generationId: 'generation-current', requestOrder: 0, workerEpoch: 1 },
    ];
    for (const context of stale) {
      expect(acceptInferenceCapture(active, context)).toBe(active);
    }
  });

  it('pauses auto-run before another selection and records terminal reasons', () => {
    let state = startGeneration(createGenerationControllerState(), {
      autoAdvance: true,
      generationId: 'generation-a',
      workerEpoch: 0,
    });
    state = setAutoAdvance(state, false);
    const context = state.pending;
    if (!context) throw new Error('Expected a pending inference.');
    state = acceptInferenceCapture(state, context);
    state = beginGenerationCommit(state);
    state = completeGenerationCommit(state, 'context-limit');
    expect(state).toMatchObject({
      autoAdvance: false,
      phase: 'complete',
      termination: 'context-limit',
    });
    expect(stopGeneration(state)).toMatchObject({ termination: 'stopped' });
  });

  it('invalidates pending work on cancellation and recovers from an error', () => {
    let state = startGeneration(createGenerationControllerState(3), {
      generationId: 'generation-a',
      workerEpoch: 3,
    });
    state = cancelGeneration(state, 4);
    expect(state).toMatchObject({ phase: 'idle', workerEpoch: 4 });
    state = failGeneration(state, 'worker failed');
    expect(state).toMatchObject({ error: 'worker failed', phase: 'error' });
    expect(recoverGeneration(state)).toMatchObject({ phase: 'idle', workerEpoch: 4 });
  });
});
