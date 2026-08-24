import type {
  GuidedExperiment,
  InstrumentCapabilityId,
  InstrumentCapabilityStatus,
} from '@observatory/domain';

export const GUIDED_EXPERIMENT_PROTOCOL_VERSION = '1' as const;
export const EXPERIMENT_REFLECTION_PREFIX = '[observatory-reflection/v1]' as const;

export type ObservationPredicate =
  | {
      readonly capability: InstrumentCapabilityId;
      readonly description: string;
      readonly kind: 'capability-verified';
    }
  | {
      readonly description: string;
      readonly kind:
        | 'attention-interventions'
        | 'distinct-prompts'
        | 'distinct-seeds'
        | 'distinct-temperatures'
        | 'distinct-top-p'
        | 'forced-selections'
        | 'probe-sweeps'
        | 'token-specimens'
        | 'whitespace-boundaries';
      readonly minimum: number;
    };

export interface VersionedGuidedExperiment extends GuidedExperiment {
  readonly predicates: readonly ObservationPredicate[];
  readonly protocolVersion: typeof GUIDED_EXPERIMENT_PROTOCOL_VERSION;
}

export interface ExperimentObservationSnapshot {
  readonly attentionInterventions: number;
  readonly capabilities: Readonly<
    Partial<Record<InstrumentCapabilityId, InstrumentCapabilityStatus>>
  >;
  readonly distinctPrompts: number;
  readonly distinctSeeds: number;
  readonly distinctTemperatures: number;
  readonly distinctTopP: number;
  readonly forcedSelections: number;
  readonly probeSweeps: number;
  readonly tokenSpecimens: number;
  readonly whitespaceBoundaries: number;
}

export interface ObservationPredicateResult {
  readonly description: string;
  readonly observed: number | string;
  readonly passed: boolean;
  readonly status: 'blocked' | 'observed' | 'pending';
}

export interface ExperimentEvaluation {
  readonly complete: boolean;
  readonly results: readonly ObservationPredicateResult[];
  readonly status: 'blocked' | 'observed' | 'pending';
}

function observedValue(
  predicate: Exclude<ObservationPredicate, { readonly kind: 'capability-verified' }>,
  snapshot: ExperimentObservationSnapshot,
): number {
  const values = {
    'attention-interventions': snapshot.attentionInterventions,
    'distinct-prompts': snapshot.distinctPrompts,
    'distinct-seeds': snapshot.distinctSeeds,
    'distinct-temperatures': snapshot.distinctTemperatures,
    'distinct-top-p': snapshot.distinctTopP,
    'forced-selections': snapshot.forcedSelections,
    'probe-sweeps': snapshot.probeSweeps,
    'token-specimens': snapshot.tokenSpecimens,
    'whitespace-boundaries': snapshot.whitespaceBoundaries,
  } as const;
  return values[predicate.kind];
}

export function evaluateObservationPredicate(
  predicate: ObservationPredicate,
  snapshot: ExperimentObservationSnapshot,
): ObservationPredicateResult {
  if (predicate.kind === 'capability-verified') {
    const observed = snapshot.capabilities[predicate.capability] ?? 'unavailable';
    const passed = observed === 'verified';
    return {
      description: predicate.description,
      observed,
      passed,
      status: passed ? 'observed' : 'blocked',
    };
  }
  const observed = observedValue(predicate, snapshot);
  const passed = observed >= predicate.minimum;
  return {
    description: predicate.description,
    observed,
    passed,
    status: passed ? 'observed' : 'pending',
  };
}

export function evaluateExperiment(
  experiment: VersionedGuidedExperiment,
  snapshot: ExperimentObservationSnapshot,
): ExperimentEvaluation {
  const results = experiment.predicates.map((predicate) =>
    evaluateObservationPredicate(predicate, snapshot),
  );
  const status = results.some((result) => result.status === 'blocked')
    ? 'blocked'
    : results.every((result) => result.passed)
      ? 'observed'
      : 'pending';
  return { complete: status === 'observed', results, status };
}

export function formatExperimentReflection(input: {
  readonly experimentId: string;
  readonly experimentVersion: string;
  readonly observationStatus: ExperimentEvaluation['status'];
  readonly reflection: string;
}): string {
  const reflection = input.reflection.trim();
  if (reflection.length === 0) throw new Error('A reflection must not be empty.');
  return `${EXPERIMENT_REFLECTION_PREFIX} ${input.experimentId}@${input.experimentVersion} ${input.observationStatus}: ${reflection}`;
}

export function isExperimentReflection(note: string, experimentId?: string): boolean {
  const prefix = experimentId
    ? `${EXPERIMENT_REFLECTION_PREFIX} ${experimentId}@`
    : EXPERIMENT_REFLECTION_PREFIX;
  return note.startsWith(prefix);
}

export const GUIDED_EXPERIMENTS: readonly VersionedGuidedExperiment[] = [
  {
    action: 'Compare temperature 0.5, 1.0 and 1.5 while logits, filters and seed stay fixed.',
    controlledVariables: ['logits', 'top-k', 'top-p', 'seed'],
    evidenceClasses: ['derived'],
    id: 'temperature-without-mysticism',
    integrityNote: 'Temperature rescales logits before softmax; it does not alter model knowledge.',
    learningObjective: 'Relate temperature scaling to probability concentration and entropy.',
    limitation:
      'This does not prove that high temperature is creative or low temperature is truthful.',
    observe: ['top probability', 'entropy', 'rank stability', 'retained mass'],
    predicates: [
      {
        description: 'At least three distinct temperatures are recorded in the trace set.',
        kind: 'distinct-temperatures',
        minimum: 3,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'How does temperature reshape a fixed candidate distribution?',
    title: 'Temperature without mysticism',
  },
  {
    action: 'Disable top-k and compare top-p at 0.5, 0.8, 0.95 and 1.0.',
    controlledVariables: ['logits', 'temperature', 'seed'],
    evidenceClasses: ['derived'],
    id: 'nucleus-boundary',
    integrityNote:
      'The boundary candidate is retained when its cumulative mass reaches the threshold.',
    learningObjective: 'See why top-p retains a variable-size candidate prefix.',
    limitation: 'Removed candidates were not impossible under the model distribution.',
    observe: ['cumulative mass', 'boundary candidate', 'survivor count', 'renormalisation'],
    predicates: [
      {
        description: 'Four distinct top-p thresholds are recorded in the trace set.',
        kind: 'distinct-top-p',
        minimum: 4,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'Which candidates survive top-p, and why does their count change?',
    title: 'The nucleus boundary',
  },
  {
    action: 'Create three branches with identical settings and different seeds.',
    controlledVariables: ['prompt', 'model build', 'logits', 'sampler settings'],
    evidenceClasses: ['measured', 'derived', 'interventional'],
    id: 'same-model-different-dice',
    integrityNote: 'Only the pseudo-random sequence changes at the first branch point.',
    learningObjective: 'Separate model output from stochastic token selection.',
    limitation: 'The model itself did not change between these branches.',
    observe: ['seeded draw', 'first token divergence', 'later compounding differences'],
    predicates: [
      {
        description: 'At least three distinct seeds are recorded.',
        kind: 'distinct-seeds',
        minimum: 3,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'What changes when only the random seed changes?',
    title: 'Same model, different dice',
  },
  {
    action: 'Compare two prompts differing by one token or punctuation mark with matched seeds.',
    controlledVariables: ['model build', 'sampler settings', 'seed'],
    evidenceClasses: ['measured', 'derived', 'interventional'],
    id: 'single-token-butterfly',
    integrityNote: 'This is a controlled rerun for one prompt pair, not a universal causal claim.',
    learningObjective: 'Observe how input changes can alter and compound future distributions.',
    limitation: 'Small edits do not always cause large downstream changes.',
    observe: ['tokenisation', 'first distribution change', 'entropy delta', 'future divergence'],
    predicates: [
      {
        description: 'At least two distinct prompts are present.',
        kind: 'distinct-prompts',
        minimum: 2,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'How can one prompt token alter later candidate distributions?',
    title: 'A single-token butterfly effect',
  },
  {
    action: 'Keep the baseline, force its second-ranked token in a child branch, then compare.',
    controlledVariables: ['prompt', 'model build', 'sampler settings'],
    evidenceClasses: ['derived', 'interventional'],
    id: 'force-runner-up',
    integrityNote:
      'The forced token is a recorded manual override, never attributed to model intent.',
    learningObjective: 'Use immutable branching to examine a locally plausible counterfactual.',
    limitation: 'The alternate future was not a hidden intention of the model.',
    observe: ['shared ancestor', 'override marker', 'first divergence', 'distribution difference'],
    predicates: [
      {
        description: 'A forced selection is recorded in an immutable branch.',
        kind: 'forced-selections',
        minimum: 1,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'What future appears if the runner-up is selected manually?',
    title: 'Force the runner-up',
  },
  {
    action: 'Scrub a supported, versioned layerwise probe from input to final layer.',
    controlledVariables: ['prompt position', 'probe version', 'candidate set'],
    evidenceClasses: ['probed', 'derived'],
    id: 'when-certainty-forms',
    integrityNote:
      'A logit lens is a probe with architectural assumptions, not a direct thought readout.',
    learningObjective: 'Inspect how decodable candidate information changes through model depth.',
    limitation: 'A layer does not literally hold a settled next-token belief.',
    observe: ['probe rank', 'probe entropy', 'candidate instability'],
    predicates: [
      {
        capability: 'logit-lens',
        description: 'The active session declares a verified logit-lens profile.',
        kind: 'capability-verified',
      },
      {
        description: 'At least one versioned layer sweep is recorded.',
        kind: 'probe-sweeps',
        minimum: 1,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'How does candidate concentration appear to evolve across layers?',
    title: 'When certainty forms',
  },
  {
    action: 'Compare one attention pattern with several controlled input interventions.',
    controlledVariables: ['head', 'layer', 'output position', 'sampler'],
    evidenceClasses: ['measured', 'interventional', 'derived'],
    id: 'attention-is-not-importance',
    integrityNote: 'Attention weights and output sensitivity answer different questions.',
    learningObjective: 'Distinguish attention measurement from interventional evidence.',
    limitation: 'Neither attention nor a single ablation provides a complete causal explanation.',
    observe: ['attention weights', 'output-distribution change', 'mismatched rankings'],
    predicates: [
      {
        capability: 'attention',
        description: 'The active session declares a verified attention profile.',
        kind: 'capability-verified',
      },
      {
        description: 'At least one matched attention intervention is recorded.',
        kind: 'attention-interventions',
        minimum: 1,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'Does high attention identify the most causally important input token?',
    title: 'Attention is not importance',
  },
  {
    action: 'Inspect paired inputs containing spaces, capitals, emoji, punctuation and rare words.',
    controlledVariables: ['tokenizer build'],
    evidenceClasses: ['measured'],
    id: 'tokenisation-surprises',
    integrityNote: 'Exact token IDs and byte fragments come from the pinned tokenizer asset.',
    learningObjective: 'Understand that language models receive token IDs rather than human words.',
    limitation: 'A token does not map cleanly to one human concept.',
    observe: ['token count', 'IDs', 'decoded fragments', 'byte boundaries'],
    predicates: [
      {
        capability: 'token-specimens',
        description: 'The active session declares the verified token-specimen profile.',
        kind: 'capability-verified',
      },
      {
        description: 'At least four exact token specimens are visible.',
        kind: 'token-specimens',
        minimum: 4,
      },
      {
        description: 'At least one leading-whitespace boundary is visible.',
        kind: 'whitespace-boundaries',
        minimum: 1,
      },
    ],
    protocolVersion: GUIDED_EXPERIMENT_PROTOCOL_VERSION,
    question: 'Why do spaces, punctuation and uncommon text form unexpected tokens?',
    title: 'Tokenisation surprises',
  },
] as const;

export function findExperiment(id: string): VersionedGuidedExperiment | undefined {
  return GUIDED_EXPERIMENTS.find((experiment) => experiment.id === id);
}
