import type {
  ExperimentTrace,
  GenerationStep,
  ModelIdentity,
  RawCandidate,
  SamplerConfig,
  SamplerInterventions,
  TokenSpecimen,
  TokenizerIdentity,
} from '@observatory/domain';
import { runSampler } from '@observatory/sampler';
import { appendStep, createTrace, forkTrace } from '@observatory/trace-schema';

export const DEMO_PROMPT = 'The night sky was';

export const DEMO_PROMPT_TOKENS: readonly TokenSpecimen[] = [
  { byteValues: [84, 104, 101], position: 0, text: 'The', tokenId: 464 },
  { byteValues: [32, 110, 105, 103, 104, 116], position: 1, text: ' night', tokenId: 1755 },
  { byteValues: [32, 115, 107, 121], position: 2, text: ' sky', tokenId: 6766 },
  { byteValues: [32, 119, 97, 115], position: 3, text: ' was', tokenId: 373 },
];

/**
 * Deliberately small teaching universe. These values are illustrative and are
 * never labelled as live model measurements in the interface or trace.
 */
export const DEMO_CANDIDATES: readonly RawCandidate[] = [
  { logit: 10.2, text: ' clear', tokenId: 1598 },
  { logit: 9.8, text: ' dark', tokenId: 3223 },
  { logit: 9.2, text: ' filled', tokenId: 3881 },
  { logit: 8.7, text: ' a', tokenId: 257 },
  { logit: 8.3, text: ' bright', tokenId: 6016 },
  { logit: 8, text: ' alive', tokenId: 4242 },
  { logit: 7.6, text: ' beautiful', tokenId: 4950 },
  { logit: 7.1, text: ' illuminated', tokenId: 17428 },
  { logit: 6.8, text: ' empty', tokenId: 5876 },
  { logit: 6.4, text: ' endless', tokenId: 16115 },
];

export const DEMO_MODEL: ModelIdentity = {
  assetHash: null,
  dtype: 'illustrative-fixture',
  id: 'observatory-teaching-fixture',
  revision: '1',
  runtime: '@observatory/sampler',
  verificationStatus: 'illustrative',
};

export const DEMO_TOKENIZER: TokenizerIdentity = {
  assetHash: null,
  id: 'gpt2-shaped-teaching-fixture',
  revision: '1',
};

export const BASELINE_CONFIG: SamplerConfig = {
  mode: 'greedy',
  seed: 'baseline',
  temperature: 1,
  topK: null,
  topP: 1,
};

export const WORKBENCH_CONFIG: SamplerConfig = {
  mode: 'sampled',
  seed: 'observatory-42',
  temperature: 0.8,
  topK: 8,
  topP: 0.95,
};

const BASELINE_CREATED_AT = '2026-08-24T00:00:00.000Z';

export function createDemoStep(
  config: SamplerConfig,
  interventions: SamplerInterventions,
  createdOrder = 0,
): GenerationStep {
  return {
    candidateUniverse: {
      captured: DEMO_CANDIDATES.length,
      complete: true,
      label: 'Complete 10-candidate teaching universe',
      size: DEMO_CANDIDATES.length,
    },
    createdOrder,
    inference: {
      durationMs: null,
      evidenceClass: 'derived',
      mode: 'illustrative-demo',
      note: 'Illustrative fixture logits; sampler transforms and seeded selection are exact.',
      verificationStatus: 'illustrative',
    },
    inputTokenIds: DEMO_PROMPT_TOKENS.map((token) => token.tokenId),
    position: DEMO_PROMPT_TOKENS.length,
    sampler: runSampler(DEMO_CANDIDATES, config, interventions),
  };
}

export function createBaselineTrace(): ExperimentTrace {
  const trace = createTrace({
    createdAt: BASELINE_CREATED_AT,
    mode: 'illustrative-demo',
    model: DEMO_MODEL,
    prompt: DEMO_PROMPT,
    promptTokens: DEMO_PROMPT_TOKENS,
    title: 'Baseline · greedy',
    tokenizer: DEMO_TOKENIZER,
    traceId: 'demo-baseline',
  });
  return appendStep(
    trace,
    createDemoStep(BASELINE_CONFIG, { forcedTokenId: null, suppressedTokenIds: [] }),
  );
}

export interface DemoBranchInput {
  readonly branchNumber: number;
  readonly config: SamplerConfig;
  readonly createdAt?: string;
  readonly interventions: SamplerInterventions;
  readonly title?: string;
}

export function createDemoBranch(
  baseline: ExperimentTrace,
  input: DemoBranchInput,
): ExperimentTrace {
  const child = forkTrace(baseline, {
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    forkStep: baseline.steps.length,
    title: input.title ?? `Branch ${input.branchNumber}`,
    traceId: `demo-branch-${input.branchNumber}`,
  });
  return appendStep(child, createDemoStep(input.config, input.interventions));
}
