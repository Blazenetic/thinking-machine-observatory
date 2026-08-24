export interface GenerationRequestContext {
  readonly generationId: string;
  readonly requestOrder: number;
  readonly workerEpoch: number;
}

export type GenerationTermination = 'cancelled' | 'context-limit' | 'eos' | 'stopped';

export type GenerationControllerState =
  | {
      readonly autoAdvance: false;
      readonly generationId: null;
      readonly pending: null;
      readonly phase: 'idle';
      readonly requestOrder: -1;
      readonly termination: null;
      readonly workerEpoch: number;
    }
  | {
      readonly autoAdvance: boolean;
      readonly generationId: string;
      readonly pending: GenerationRequestContext;
      readonly phase: 'inferring';
      readonly requestOrder: number;
      readonly termination: null;
      readonly workerEpoch: number;
    }
  | {
      readonly autoAdvance: boolean;
      readonly generationId: string;
      readonly pending: null;
      readonly phase: 'paused-before-selection' | 'committing';
      readonly requestOrder: number;
      readonly termination: null;
      readonly workerEpoch: number;
    }
  | {
      readonly autoAdvance: false;
      readonly generationId: string;
      readonly pending: null;
      readonly phase: 'complete';
      readonly requestOrder: number;
      readonly termination: Exclude<GenerationTermination, 'cancelled'>;
      readonly workerEpoch: number;
    }
  | {
      readonly autoAdvance: false;
      readonly error: string;
      readonly generationId: string | null;
      readonly pending: null;
      readonly phase: 'error';
      readonly requestOrder: number;
      readonly termination: null;
      readonly workerEpoch: number;
    };

export class GenerationControllerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'GenerationControllerError';
  }
}

export function createGenerationControllerState(workerEpoch = 0): GenerationControllerState {
  return {
    autoAdvance: false,
    generationId: null,
    pending: null,
    phase: 'idle',
    requestOrder: -1,
    termination: null,
    workerEpoch,
  };
}

export function sameGenerationRequest(
  left: GenerationRequestContext,
  right: GenerationRequestContext,
): boolean {
  return (
    left.generationId === right.generationId &&
    left.requestOrder === right.requestOrder &&
    left.workerEpoch === right.workerEpoch
  );
}

function inferenceState(
  generationId: string,
  requestOrder: number,
  workerEpoch: number,
  autoAdvance: boolean,
): GenerationControllerState {
  const pending = { generationId, requestOrder, workerEpoch };
  return {
    autoAdvance,
    generationId,
    pending,
    phase: 'inferring',
    requestOrder,
    termination: null,
    workerEpoch,
  };
}

export function startGeneration(
  state: GenerationControllerState,
  input: {
    readonly autoAdvance?: boolean;
    readonly generationId: string;
    readonly workerEpoch: number;
  },
): GenerationControllerState {
  if (input.generationId.length === 0) {
    throw new GenerationControllerError('Generation ID must not be empty.');
  }
  if (!Number.isInteger(input.workerEpoch) || input.workerEpoch < state.workerEpoch) {
    throw new GenerationControllerError('Worker epoch must be monotonic.');
  }
  return inferenceState(input.generationId, 0, input.workerEpoch, input.autoAdvance ?? false);
}

/** Stale captures are ignored without changing any controller field. */
export function acceptInferenceCapture(
  state: GenerationControllerState,
  context: GenerationRequestContext,
): GenerationControllerState {
  if (
    state.phase !== 'inferring' ||
    !state.pending ||
    !sameGenerationRequest(state.pending, context)
  ) {
    return state;
  }
  return {
    ...state,
    pending: null,
    phase: 'paused-before-selection',
  };
}

export function setAutoAdvance(
  state: GenerationControllerState,
  autoAdvance: boolean,
): GenerationControllerState {
  if (state.phase === 'idle' || state.phase === 'complete' || state.phase === 'error') return state;
  return { ...state, autoAdvance };
}

export function beginGenerationCommit(state: GenerationControllerState): GenerationControllerState {
  if (state.phase !== 'paused-before-selection') {
    throw new GenerationControllerError('A step can commit only from the pre-selection pause.');
  }
  return { ...state, phase: 'committing' };
}

export function completeGenerationCommit(
  state: GenerationControllerState,
  termination: Extract<GenerationTermination, 'context-limit' | 'eos'> | null = null,
): GenerationControllerState {
  if (state.phase !== 'committing') {
    throw new GenerationControllerError('No generation step is being committed.');
  }
  if (termination) {
    return {
      autoAdvance: false,
      generationId: state.generationId,
      pending: null,
      phase: 'complete',
      requestOrder: state.requestOrder,
      termination,
      workerEpoch: state.workerEpoch,
    };
  }
  return inferenceState(
    state.generationId,
    state.requestOrder + 1,
    state.workerEpoch,
    state.autoAdvance,
  );
}

export function stopGeneration(state: GenerationControllerState): GenerationControllerState {
  if (state.phase === 'idle') return state;
  if (state.phase === 'error') return state;
  return {
    autoAdvance: false,
    generationId: state.generationId,
    pending: null,
    phase: 'complete',
    requestOrder: state.requestOrder,
    termination: 'stopped',
    workerEpoch: state.workerEpoch,
  };
}

export function cancelGeneration(
  state: GenerationControllerState,
  nextWorkerEpoch: number,
): GenerationControllerState {
  if (!Number.isInteger(nextWorkerEpoch) || nextWorkerEpoch <= state.workerEpoch) {
    throw new GenerationControllerError('Cancellation must advance the worker epoch.');
  }
  return createGenerationControllerState(nextWorkerEpoch);
}

export function failGeneration(
  state: GenerationControllerState,
  message: string,
): GenerationControllerState {
  return {
    autoAdvance: false,
    error: message,
    generationId: state.generationId,
    pending: null,
    phase: 'error',
    requestOrder: state.requestOrder,
    termination: null,
    workerEpoch: state.workerEpoch,
  };
}

export function recoverGeneration(state: GenerationControllerState): GenerationControllerState {
  if (state.phase !== 'error') return state;
  return createGenerationControllerState(state.workerEpoch);
}
