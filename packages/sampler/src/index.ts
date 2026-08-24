import type {
  CandidateRecord,
  PrngState,
  RawCandidate,
  SamplerConfig,
  SamplerInterventions,
  SamplerResult,
  SelectionRecord,
} from '@observatory/domain';

const UINT32_RANGE = 4_294_967_296;
const EPSILON = 1e-12;

export const DEFAULT_SAMPLER_CONFIG: SamplerConfig = {
  mode: 'sampled',
  seed: 'observatory-42',
  temperature: 0.8,
  topK: 8,
  topP: 0.95,
};

export const NO_INTERVENTIONS: SamplerInterventions = {
  forcedTokenId: null,
  suppressedTokenIds: [],
};

export class SamplerConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SamplerConfigurationError';
  }
}

function assertPrngState(state: PrngState): void {
  if (
    state.length !== 4 ||
    state.some((value) => !Number.isInteger(value) || value < 0 || value > 4_294_967_295) ||
    state.every((value) => value === 0)
  ) {
    throw new SamplerConfigurationError(
      'PRNG state must contain four unsigned 32-bit words and must not be all zero.',
    );
  }
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

/** Stable 128-bit string hash used only to seed the trace-owned PRNG. */
export function seedToState(seed: string): PrngState {
  let h1 = 1_779_033_703;
  let h2 = 3_144_134_277;
  let h3 = 1_013_904_242;
  let h4 = 2_773_480_762;

  for (let index = 0; index < seed.length; index += 1) {
    const character = seed.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ character, 597_399_067);
    h2 = h3 ^ Math.imul(h2 ^ character, 2_869_860_233);
    h3 = h4 ^ Math.imul(h3 ^ character, 951_274_213);
    h4 = h1 ^ Math.imul(h4 ^ character, 2_716_044_179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597_399_067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2_869_860_233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951_274_213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2_716_044_179);

  const state: [number, number, number, number] = [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];

  if (state.every((value) => value === 0)) {
    state[3] = 1;
  }

  return state;
}

/** xoshiro128** with explicit, serialisable state. */
export class Xoshiro128StarStar {
  readonly #state: [number, number, number, number];

  public constructor(seedOrState: string | PrngState) {
    const state = typeof seedOrState === 'string' ? seedToState(seedOrState) : seedOrState;
    assertPrngState(state);
    this.#state = [...state];
  }

  public getState(): PrngState {
    return [...this.#state];
  }

  public nextUint32(): number {
    const result = Math.imul(rotateLeft(Math.imul(this.#state[1], 5) >>> 0, 7), 9) >>> 0;
    const temporary = (this.#state[1] << 9) >>> 0;

    this.#state[2] = (this.#state[2] ^ this.#state[0]) >>> 0;
    this.#state[3] = (this.#state[3] ^ this.#state[1]) >>> 0;
    this.#state[1] = (this.#state[1] ^ this.#state[2]) >>> 0;
    this.#state[0] = (this.#state[0] ^ this.#state[3]) >>> 0;
    this.#state[2] = (this.#state[2] ^ temporary) >>> 0;
    this.#state[3] = rotateLeft(this.#state[3], 11);

    return result;
  }

  public nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }
}

export function stableSoftmax(values: readonly number[]): number[] {
  if (values.length === 0) {
    throw new SamplerConfigurationError('Softmax requires at least one value.');
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new SamplerConfigurationError('Softmax values must be finite.');
  }

  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);

  return exponentials.map((value) => value / total);
}

export function entropyBits(probabilities: readonly number[]): number {
  return probabilities.reduce(
    (total, probability) =>
      probability <= 0 ? total : total - probability * Math.log2(probability),
    0,
  );
}

export function validateSamplerConfig(config: SamplerConfig): void {
  if (!Number.isFinite(config.temperature) || config.temperature <= 0) {
    throw new SamplerConfigurationError('Temperature must be a finite number greater than zero.');
  }
  if (config.topK !== null && (!Number.isInteger(config.topK) || config.topK < 1)) {
    throw new SamplerConfigurationError('Top-k must be null or a positive integer.');
  }
  if (!Number.isFinite(config.topP) || config.topP <= 0 || config.topP > 1) {
    throw new SamplerConfigurationError('Top-p must be greater than zero and at most one.');
  }
  if (config.seed.length === 0) {
    throw new SamplerConfigurationError('Seed must not be empty.');
  }
}

interface WorkingCandidate extends RawCandidate {
  readonly inputOrder: number;
  cumulativeProbabilityBeforeTopP: number | null;
  finalProbability: number;
  interval: [number, number] | null;
  probabilityBeforeTopP: number;
  rawRank: number;
  retainedByTopK: boolean;
  retainedByTopP: boolean;
  temperatureScaledLogit: number | null;
  eliminationReason: CandidateRecord['eliminationReason'];
}

function assertCandidates(candidates: readonly RawCandidate[]): void {
  if (candidates.length === 0) {
    throw new SamplerConfigurationError('Sampling requires at least one candidate.');
  }

  const tokenIds = new Set<number>();
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.logit)) {
      throw new SamplerConfigurationError(`Token ${candidate.tokenId} has a non-finite logit.`);
    }
    if (tokenIds.has(candidate.tokenId)) {
      throw new SamplerConfigurationError(`Token ${candidate.tokenId} appears more than once.`);
    }
    tokenIds.add(candidate.tokenId);
  }
}

function buildWorkingCandidates(
  candidates: readonly RawCandidate[],
  config: SamplerConfig,
  interventions: SamplerInterventions,
): WorkingCandidate[] {
  const suppressed = new Set(interventions.suppressedTokenIds);
  const ordered = candidates
    .map((candidate, inputOrder) => ({ ...candidate, inputOrder }))
    .sort((left, right) => right.logit - left.logit || left.inputOrder - right.inputOrder);

  return ordered.map((candidate, rawRank) => {
    const isSuppressed = suppressed.has(candidate.tokenId);
    return {
      ...candidate,
      cumulativeProbabilityBeforeTopP: null,
      eliminationReason: isSuppressed ? 'suppressed' : null,
      finalProbability: 0,
      interval: null,
      probabilityBeforeTopP: 0,
      rawRank: rawRank + 1,
      retainedByTopK: false,
      retainedByTopP: false,
      temperatureScaledLogit: isSuppressed
        ? null
        : config.mode === 'greedy'
          ? candidate.logit
          : candidate.logit / config.temperature,
    };
  });
}

function applyTopK(candidates: WorkingCandidate[], topK: number | null): WorkingCandidate[] {
  const available = candidates.filter((candidate) => candidate.eliminationReason === null);
  const retainCount = Math.min(topK ?? available.length, available.length);

  available.forEach((candidate, index) => {
    if (index < retainCount) {
      candidate.retainedByTopK = true;
    } else {
      candidate.eliminationReason = 'top-k';
    }
  });

  return available.slice(0, retainCount);
}

function applyTopP(candidates: WorkingCandidate[], topP: number): WorkingCandidate[] {
  const probabilities = stableSoftmax(
    candidates.map((candidate) => candidate.temperatureScaledLogit as number),
  );
  let cumulative = 0;
  let boundaryReached = false;
  const retained: WorkingCandidate[] = [];

  candidates.forEach((candidate, index) => {
    const probability = probabilities[index] as number;
    cumulative += probability;
    candidate.probabilityBeforeTopP = probability;
    candidate.cumulativeProbabilityBeforeTopP = Math.min(cumulative, 1);

    if (!boundaryReached) {
      candidate.retainedByTopP = true;
      retained.push(candidate);
      if (cumulative + EPSILON >= topP) {
        boundaryReached = true;
      }
    } else {
      candidate.eliminationReason = 'top-p';
    }
  });

  return retained;
}

function assignFinalDistribution(candidates: WorkingCandidate[]): void {
  const retainedMass = candidates.reduce(
    (sum, candidate) => sum + candidate.probabilityBeforeTopP,
    0,
  );
  let lowerBound = 0;

  candidates.forEach((candidate, index) => {
    candidate.finalProbability = candidate.probabilityBeforeTopP / retainedMass;
    const upperBound =
      index === candidates.length - 1 ? 1 : Math.min(1, lowerBound + candidate.finalProbability);
    candidate.interval = [lowerBound, upperBound];
    lowerBound = upperBound;
  });
}

function selectCandidate(
  candidates: WorkingCandidate[],
  allCandidates: WorkingCandidate[],
  config: SamplerConfig,
  interventions: SamplerInterventions,
  prngState?: PrngState,
): SelectionRecord {
  if (interventions.forcedTokenId !== null) {
    const forced = allCandidates.find(
      (candidate) => candidate.tokenId === interventions.forcedTokenId,
    );
    if (!forced) {
      throw new SamplerConfigurationError(
        `Forced token ${interventions.forcedTokenId} is not in the candidate universe.`,
      );
    }
    if (forced.eliminationReason === 'suppressed') {
      throw new SamplerConfigurationError('The same token cannot be both forced and suppressed.');
    }
    return {
      draw: null,
      interval: forced.interval,
      mode: 'forced',
      probability: forced.finalProbability,
      text: forced.text,
      tokenId: forced.tokenId,
    };
  }

  const first = candidates[0];
  if (!first) {
    throw new SamplerConfigurationError('Every candidate was suppressed.');
  }

  if (config.mode === 'greedy') {
    return {
      draw: null,
      interval: first.interval,
      mode: 'greedy',
      probability: first.finalProbability,
      text: first.text,
      tokenId: first.tokenId,
    };
  }

  const generator = new Xoshiro128StarStar(prngState ?? config.seed);
  const stateBefore = generator.getState();
  const value = generator.nextFloat();
  const stateAfter = generator.getState();
  const selected =
    candidates.find((candidate) => candidate.interval !== null && value < candidate.interval[1]) ??
    candidates.at(-1);

  if (!selected) {
    throw new SamplerConfigurationError('No candidate interval contained the seeded draw.');
  }

  return {
    draw: {
      algorithm: 'xoshiro128**',
      stateAfter,
      stateBefore,
      value,
    },
    interval: selected.interval,
    mode: 'sampled',
    probability: selected.finalProbability,
    text: selected.text,
    tokenId: selected.tokenId,
  };
}

/**
 * Applies suppression → temperature → top-k → softmax → top-p → renormalisation
 * → seeded selection. Ties retain the caller's candidate order.
 */
export function runSampler(
  rawCandidates: readonly RawCandidate[],
  config: SamplerConfig,
  interventions: SamplerInterventions = NO_INTERVENTIONS,
  prngState?: PrngState,
): SamplerResult {
  validateSamplerConfig(config);
  assertCandidates(rawCandidates);

  const candidates = buildWorkingCandidates(rawCandidates, config, interventions);
  const topKCandidates = applyTopK(candidates, config.topK);
  if (topKCandidates.length === 0) {
    throw new SamplerConfigurationError('At least one candidate must remain after suppression.');
  }
  const topPCandidates = applyTopP(topKCandidates, config.topP);
  assignFinalDistribution(topPCandidates);
  const selection = selectCandidate(topPCandidates, candidates, config, interventions, prngState);

  const records: CandidateRecord[] = candidates.map((candidate) => {
    const { inputOrder, ...record } = candidate;
    void inputOrder;
    return Object.freeze(record);
  });

  return Object.freeze({
    candidates: Object.freeze(records),
    config: Object.freeze({ ...config }),
    entropyBits: entropyBits(topPCandidates.map((candidate) => candidate.finalProbability)),
    interventions: Object.freeze({
      forcedTokenId: interventions.forcedTokenId,
      suppressedTokenIds: Object.freeze([...interventions.suppressedTokenIds]),
    }),
    selection: Object.freeze(selection),
  });
}
