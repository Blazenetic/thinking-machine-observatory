/**
 * Shared scientific and trace vocabulary.
 *
 * Keep this package dependency-free. Runtime adapters, UI components and schema
 * validators may depend on it; it must never depend on them.
 */

export const TRACE_SCHEMA_VERSION = '1.0.0' as const;
export const SAMPLER_CALCULATION_VERSION = '1' as const;

export const EVIDENCE_CLASSES = {
  measured: {
    abbreviation: 'M',
    description: 'Returned directly by a model, runtime or sampler.',
    label: 'Measured',
  },
  derived: {
    abbreviation: 'D',
    description: 'Calculated exactly from measured or fixture values.',
    label: 'Derived',
  },
  projected: {
    abbreviation: 'P',
    description: 'Mapped through a lossy visual transformation.',
    label: 'Projected',
  },
  probed: {
    abbreviation: 'R',
    description: 'Produced by an interpretability method with assumptions.',
    label: 'Probed',
  },
  interventional: {
    abbreviation: 'I',
    description: 'Measured or calculated after a controlled change.',
    label: 'Interventional',
  },
} as const;

export type EvidenceClass = keyof typeof EVIDENCE_CLASSES;

export interface EvidenceDatum<T> {
  readonly evidenceClass: EvidenceClass;
  readonly method: string;
  readonly value: T;
  readonly caveat?: string;
}

export type ExecutionMode = 'illustrative-demo' | 'live-wasm' | 'live-webgpu';
export type VerificationStatus = 'illustrative' | 'unverified' | 'verified';

export interface AssetIdentity {
  readonly assetHash: string | null;
  readonly id: string;
  readonly revision: string;
}

export interface ModelIdentity extends AssetIdentity {
  readonly dtype: string;
  readonly runtime: string;
  readonly verificationStatus: VerificationStatus;
}

export type TokenizerIdentity = AssetIdentity;

export interface TokenSpecimen {
  readonly byteValues: readonly number[];
  readonly position: number;
  readonly text: string;
  readonly tokenId: number;
}

export interface RawCandidate {
  readonly logit: number;
  readonly text: string;
  readonly tokenId: number;
}

export type SamplerMode = 'greedy' | 'sampled';

export interface SamplerConfig {
  readonly mode: SamplerMode;
  readonly seed: string;
  readonly temperature: number;
  readonly topK: number | null;
  readonly topP: number;
}

export interface SamplerInterventions {
  readonly forcedTokenId: number | null;
  readonly suppressedTokenIds: readonly number[];
}

export type EliminationReason = 'suppressed' | 'top-k' | 'top-p' | null;

/** JSON-safe record of every sampler stage for one candidate. */
export interface CandidateRecord extends RawCandidate {
  readonly cumulativeProbabilityBeforeTopP: number | null;
  readonly eliminationReason: EliminationReason;
  readonly finalProbability: number;
  readonly interval: readonly [number, number] | null;
  readonly probabilityBeforeTopP: number;
  readonly rawRank: number;
  readonly retainedByTopK: boolean;
  readonly retainedByTopP: boolean;
  readonly temperatureScaledLogit: number | null;
}

export type PrngState = readonly [number, number, number, number];

export interface RandomDraw {
  readonly algorithm: 'xoshiro128**';
  readonly stateAfter: PrngState;
  readonly stateBefore: PrngState;
  readonly value: number;
}

export type SelectionMode = 'forced' | 'greedy' | 'sampled';

export interface SelectionRecord {
  readonly draw: RandomDraw | null;
  readonly interval: readonly [number, number] | null;
  readonly mode: SelectionMode;
  readonly probability: number;
  readonly text: string;
  readonly tokenId: number;
}

export interface SamplerResult {
  readonly candidates: readonly CandidateRecord[];
  readonly config: SamplerConfig;
  readonly entropyBits: number;
  readonly interventions: SamplerInterventions;
  readonly selection: SelectionRecord;
}

export interface CandidateUniverse {
  readonly captured: number;
  readonly complete: boolean;
  readonly label: string;
  readonly size: number;
}

export interface InferenceProvenance {
  readonly durationMs: number | null;
  readonly evidenceClass: EvidenceClass;
  readonly mode: ExecutionMode;
  readonly note: string;
  readonly verificationStatus: VerificationStatus;
}

export interface GenerationStep {
  readonly candidateUniverse: CandidateUniverse;
  readonly createdOrder: number;
  readonly inference: InferenceProvenance;
  readonly inputTokenIds: readonly number[];
  readonly position: number;
  readonly sampler: SamplerResult;
}

export interface TraceParent {
  readonly forkStep: number;
  readonly traceId: string;
}

export interface TraceAnnotation {
  readonly createdAt: string;
  readonly id: string;
  readonly note: string;
  readonly step: number | null;
}

export interface CalculationVersions {
  readonly entropy: 'bits-1';
  readonly sampler: typeof SAMPLER_CALCULATION_VERSION;
  readonly softmax: 'stable-1';
}

export interface ExperimentTrace {
  readonly annotations: readonly TraceAnnotation[];
  readonly calculationVersions: CalculationVersions;
  readonly createdAt: string;
  readonly mode: ExecutionMode;
  readonly model: ModelIdentity;
  readonly parent: TraceParent | null;
  readonly prompt: string;
  readonly promptTokens: readonly TokenSpecimen[];
  readonly schemaVersion: typeof TRACE_SCHEMA_VERSION;
  readonly steps: readonly GenerationStep[];
  readonly title: string;
  readonly tokenizer: TokenizerIdentity;
  readonly traceId: string;
}

export interface BranchComparison {
  readonly compatible: boolean;
  readonly entropyDeltaBits: number | null;
  readonly firstDivergenceStep: number | null;
  readonly jensenShannonBits: number | null;
  readonly reason: string | null;
  readonly selectedTokenChanged: boolean;
}

export interface RuntimeCapabilities {
  readonly indexedDb: boolean;
  readonly secureContext: boolean;
  readonly webGpu: boolean;
  readonly webWorker: boolean;
}

export type InferenceStatus =
  | { readonly state: 'idle' }
  | { readonly state: 'loading'; readonly progress: number; readonly message: string }
  | { readonly state: 'ready'; readonly model: ModelIdentity }
  | { readonly state: 'predicting' }
  | { readonly state: 'error'; readonly message: string };

export interface PredictionCapture {
  readonly candidateUniverse: CandidateUniverse;
  readonly candidates: readonly RawCandidate[];
  readonly durationMs: number;
  readonly mode: Exclude<ExecutionMode, 'illustrative-demo'>;
  readonly model: ModelIdentity;
  readonly promptTokens: readonly TokenSpecimen[];
  readonly tokenizer: TokenizerIdentity;
}

export interface GuidedExperiment {
  readonly action: string;
  readonly controlledVariables: readonly string[];
  readonly evidenceClasses: readonly EvidenceClass[];
  readonly id: string;
  readonly integrityNote: string;
  readonly learningObjective: string;
  readonly limitation: string;
  readonly observe: readonly string[];
  readonly question: string;
  readonly title: string;
}
