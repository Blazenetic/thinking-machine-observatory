import {
  SAMPLER_CALCULATION_VERSION,
  type CalculationVersions,
  type CandidateUniverse,
  type ExperimentTrace,
  type InferenceProvenance,
  type ModelIdentity,
  type PrngState,
  type RawCandidate,
  type SamplerConfig,
  type SamplerInterventions,
  type SelectionRecord,
  type TokenSpecimen,
  type TokenizerIdentity,
  type TraceAnnotation,
  type TraceParent,
} from '@observatory/domain';
import { runSampler, seedToState } from '@observatory/sampler';
import { z } from 'zod';

import {
  createEmbeddedFloat32Payload,
  decodeEmbeddedFloat32Payload,
  type EmbeddedFloat32Payload,
} from './logit-payload.ts';

export const COMPACT_TRACE_SCHEMA_VERSION = '1.2.0' as const;

export const COMPACT_TRACE_LIMITS = Object.freeze({
  importBytes: 32 * 1024 * 1024,
  payloadCount: 256,
  totalFloat32Values: 4_000_000,
  traceCount: 128,
  totalSteps: 1_024,
  stepsPerTrace: 256,
  displayCandidatesPerStep: 200,
});

export interface DecodedCandidate {
  readonly text: string;
  readonly tokenId: number;
}

export interface CompactSamplerRecord {
  readonly config: SamplerConfig;
  readonly entropyBits: number;
  readonly interventions: SamplerInterventions;
  readonly prngStateAfter: PrngState;
  readonly prngStateBefore: PrngState;
  readonly seedReset: string | null;
  readonly selection: SelectionRecord;
}

export interface CompactGenerationStep {
  readonly candidateTokenIds: readonly number[] | null;
  readonly candidateUniverse: CandidateUniverse;
  readonly createdOrder: number;
  readonly decodedCandidates: readonly DecodedCandidate[];
  readonly inference: InferenceProvenance;
  readonly inputTokenIds: readonly number[];
  readonly logitsRef: string;
  readonly position: number;
  readonly sampler: CompactSamplerRecord;
}

export interface CompactTraceNode {
  readonly annotations: readonly TraceAnnotation[];
  readonly calculationVersions: CalculationVersions;
  readonly createdAt: string;
  readonly mode: ExperimentTrace['mode'];
  readonly model: ModelIdentity;
  readonly parent: TraceParent | null;
  readonly prompt: string;
  readonly promptTokens: readonly TokenSpecimen[];
  readonly rootSeed: string;
  readonly steps: readonly CompactGenerationStep[];
  readonly title: string;
  readonly tokenizer: TokenizerIdentity;
  readonly traceId: string;
}

/** Portable export. Ancestors and content-addressed payloads appear exactly once. */
export interface CompactTraceBundle {
  readonly exportedAt: string;
  readonly payloads: Readonly<Record<string, EmbeddedFloat32Payload>>;
  readonly rootTraceId: string;
  readonly schemaVersion: typeof COMPACT_TRACE_SCHEMA_VERSION;
  readonly traces: readonly CompactTraceNode[];
}

export interface CreateCompactTraceInput {
  readonly createdAt?: string;
  readonly mode: ExperimentTrace['mode'];
  readonly model: ModelIdentity;
  readonly prompt: string;
  readonly promptTokens: readonly TokenSpecimen[];
  readonly rootSeed: string;
  readonly title: string;
  readonly tokenizer: TokenizerIdentity;
  readonly traceId?: string;
}

export interface CreateCompactStepInput {
  readonly candidateUniverse: CandidateUniverse;
  readonly config: SamplerConfig;
  readonly createdOrder: number;
  readonly decodedCandidateLimit?: number;
  readonly inference: InferenceProvenance;
  readonly inputTokenIds: readonly number[];
  readonly interventions?: SamplerInterventions;
  readonly prngStateBefore?: PrngState;
  readonly rawCandidates: readonly RawCandidate[];
  readonly seedReset?: string | null;
}

export interface CompactStepWithPayload {
  readonly payload: EmbeddedFloat32Payload;
  readonly step: CompactGenerationStep;
}

export interface CompactStepReplayResult {
  readonly matches: boolean;
  readonly position: number;
  readonly reasons: readonly string[];
}

export interface CompactBundleReplayResult {
  readonly matches: boolean;
  readonly steps: readonly CompactStepReplayResult[];
  readonly traceId: string;
}

export class CompactTraceError extends Error {
  public readonly issues: readonly z.core.$ZodIssue[];

  public constructor(message: string, issues: readonly z.core.$ZodIssue[] = []) {
    super(message);
    this.name = 'CompactTraceError';
    this.issues = issues;
  }
}

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PrngStateSchema = z.tuple([
  z.number().int().nonnegative().max(4_294_967_295),
  z.number().int().nonnegative().max(4_294_967_295),
  z.number().int().nonnegative().max(4_294_967_295),
  z.number().int().nonnegative().max(4_294_967_295),
]);
const AssetIdentitySchema = z
  .object({
    assetHash: z.string().min(1).nullable(),
    id: z.string().min(1),
    revision: z.string().min(1),
  })
  .strict();
const ModelIdentitySchema = AssetIdentitySchema.extend({
  dtype: z.string().min(1),
  runtime: z.string().min(1),
  verificationStatus: z.enum(['illustrative', 'unverified', 'verified']),
}).strict();
const TokenSpecimenSchema = z
  .object({
    byteValues: z.array(z.number().int().min(0).max(255)),
    position: z.number().int().nonnegative(),
    text: z.string(),
    tokenId: z.number().int(),
  })
  .strict();
const InferenceSchema = z
  .object({
    durationMs: z.number().finite().nonnegative().nullable(),
    evidenceClass: z.enum(['measured', 'derived', 'projected', 'probed', 'interventional']),
    logitsSha256: Sha256Schema.nullable(),
    mode: z.enum(['illustrative-demo', 'live-wasm', 'live-webgpu']),
    note: z.string().min(1),
    verificationProfileId: z.string().min(1).nullable(),
    verificationStatus: z.enum(['illustrative', 'unverified', 'verified']),
  })
  .strict();
const SamplerConfigSchema = z
  .object({
    mode: z.enum(['greedy', 'sampled']),
    seed: z.string().min(1),
    temperature: z.number().finite().positive(),
    topK: z.number().int().positive().nullable(),
    topP: z.number().finite().positive().max(1),
  })
  .strict();
const InterventionsSchema = z
  .object({
    forcedTokenId: z.number().int().nullable(),
    suppressedTokenIds: z.array(z.number().int()),
  })
  .strict();
const SelectionSchema = z
  .object({
    draw: z
      .object({
        algorithm: z.literal('xoshiro128**'),
        stateAfter: PrngStateSchema,
        stateBefore: PrngStateSchema,
        value: z.number().finite().min(0).lt(1),
      })
      .strict()
      .nullable(),
    interval: z
      .tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)])
      .nullable(),
    mode: z.enum(['forced', 'greedy', 'sampled']),
    probability: z.number().finite().min(0).max(1),
    text: z.string(),
    tokenId: z.number().int(),
  })
  .strict();
const PayloadSchema = z
  .object({
    data: z.string().min(1),
    encoding: z.literal('float32-le-base64'),
    sha256: Sha256Schema,
    valueCount: z.number().int().positive().max(1_000_000),
  })
  .strict();
const CompactStepSchema = z
  .object({
    candidateTokenIds: z.array(z.number().int()).min(1).nullable(),
    candidateUniverse: z
      .object({
        captured: z.number().int().nonnegative(),
        complete: z.boolean(),
        label: z.string().min(1),
        size: z.number().int().positive().max(1_000_000),
      })
      .strict(),
    createdOrder: z.number().int().nonnegative(),
    decodedCandidates: z
      .array(z.object({ text: z.string(), tokenId: z.number().int() }).strict())
      .max(COMPACT_TRACE_LIMITS.displayCandidatesPerStep),
    inference: InferenceSchema,
    inputTokenIds: z.array(z.number().int()).min(1).max(4_096),
    logitsRef: Sha256Schema,
    position: z.number().int().positive(),
    sampler: z
      .object({
        config: SamplerConfigSchema,
        entropyBits: z.number().finite().nonnegative(),
        interventions: InterventionsSchema,
        prngStateAfter: PrngStateSchema,
        prngStateBefore: PrngStateSchema,
        seedReset: z.string().min(1).nullable(),
        selection: SelectionSchema,
      })
      .strict(),
  })
  .strict();
const TraceNodeSchema = z
  .object({
    annotations: z.array(
      z
        .object({
          createdAt: z.iso.datetime(),
          id: z.string().min(1),
          note: z.string().min(1),
          step: z.number().int().nonnegative().nullable(),
        })
        .strict(),
    ),
    calculationVersions: z
      .object({
        entropy: z.literal('bits-1'),
        sampler: z.literal(SAMPLER_CALCULATION_VERSION),
        softmax: z.literal('stable-1'),
      })
      .strict(),
    createdAt: z.iso.datetime(),
    mode: z.enum(['illustrative-demo', 'live-wasm', 'live-webgpu']),
    model: ModelIdentitySchema,
    parent: z
      .object({ forkStep: z.number().int().nonnegative(), traceId: z.string().min(1) })
      .strict()
      .nullable(),
    prompt: z.string().min(1),
    promptTokens: z.array(TokenSpecimenSchema).min(1).max(4_096),
    rootSeed: z.string().min(1),
    steps: z.array(CompactStepSchema).max(COMPACT_TRACE_LIMITS.stepsPerTrace),
    title: z.string().min(1),
    tokenizer: AssetIdentitySchema,
    traceId: z.string().min(1),
  })
  .strict();
const CompactTraceBundleSchema = z
  .object({
    exportedAt: z.iso.datetime(),
    payloads: z.record(Sha256Schema, PayloadSchema),
    rootTraceId: z.string().min(1),
    schemaVersion: z.literal(COMPACT_TRACE_SCHEMA_VERSION),
    traces: z.array(TraceNodeSchema).min(1).max(COMPACT_TRACE_LIMITS.traceCount),
  })
  .strict();

function defaultId(): string {
  return globalThis.crypto.randomUUID();
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
  }
  return value;
}

function canonicalJson(value: unknown): string {
  const normalise = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalise);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalise(nested)]),
      );
    }
    return item;
  };
  return JSON.stringify(normalise(value));
}

function sameState(left: PrngState, right: PrngState): boolean {
  return left.every((value, index) => value === right[index]);
}

function parseStructure(value: unknown): CompactTraceBundle {
  const result = CompactTraceBundleSchema.safeParse(value);
  if (!result.success) {
    throw new CompactTraceError(
      `Trace bundle did not satisfy schema ${COMPACT_TRACE_SCHEMA_VERSION}.`,
      result.error.issues,
    );
  }
  return deepFreeze(result.data);
}

function orderedCandidates(rawCandidates: readonly RawCandidate[]): {
  readonly candidateTokenIds: readonly number[] | null;
  readonly candidates: readonly RawCandidate[];
} {
  const ids = new Set(rawCandidates.map((candidate) => candidate.tokenId));
  const indexed =
    ids.size === rawCandidates.length && rawCandidates.every((_, tokenId) => ids.has(tokenId));
  if (indexed) {
    return {
      candidateTokenIds: null,
      candidates: [...rawCandidates].sort((left, right) => left.tokenId - right.tokenId),
    };
  }
  return {
    candidateTokenIds: rawCandidates.map((candidate) => candidate.tokenId),
    candidates: rawCandidates,
  };
}

function decodedSnapshot(
  candidates: readonly RawCandidate[],
  limit: number,
): readonly DecodedCandidate[] {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > COMPACT_TRACE_LIMITS.displayCandidatesPerStep
  ) {
    throw new CompactTraceError(
      `Decoded candidate limit must be from 1 to ${COMPACT_TRACE_LIMITS.displayCandidatesPerStep}.`,
    );
  }
  return [...candidates]
    .map((candidate, inputOrder) => ({ ...candidate, inputOrder }))
    .sort((left, right) => right.logit - left.logit || left.inputOrder - right.inputOrder)
    .filter((candidate) => candidate.text.length > 0)
    .slice(0, limit)
    .map(({ text, tokenId }) => ({ text, tokenId }));
}

function rawCandidatesFromValues(
  step: CompactGenerationStep,
  values: Float32Array,
): readonly RawCandidate[] {
  const textByToken = new Map(
    step.decodedCandidates.map((candidate) => [candidate.tokenId, candidate.text]),
  );
  return Array.from(values, (logit, index) => {
    const tokenId = step.candidateTokenIds?.[index] ?? index;
    if (tokenId === undefined) {
      throw new CompactTraceError('Candidate token ID map is shorter than its payload.');
    }
    return { logit, text: textByToken.get(tokenId) ?? '', tokenId };
  });
}

export function createCompactTraceBundle(input: CreateCompactTraceInput): CompactTraceBundle {
  const traceId = input.traceId ?? defaultId();
  return parseStructure({
    exportedAt: input.createdAt ?? new Date().toISOString(),
    payloads: {},
    rootTraceId: traceId,
    schemaVersion: COMPACT_TRACE_SCHEMA_VERSION,
    traces: [
      {
        annotations: [],
        calculationVersions: {
          entropy: 'bits-1',
          sampler: SAMPLER_CALCULATION_VERSION,
          softmax: 'stable-1',
        },
        createdAt: input.createdAt ?? new Date().toISOString(),
        mode: input.mode,
        model: input.model,
        parent: null,
        prompt: input.prompt,
        promptTokens: input.promptTokens,
        rootSeed: input.rootSeed,
        steps: [],
        title: input.title,
        tokenizer: input.tokenizer,
        traceId,
      },
    ],
  });
}

export async function createCompactGenerationStep(
  input: CreateCompactStepInput,
): Promise<CompactStepWithPayload> {
  if (!input.candidateUniverse.complete) {
    throw new CompactTraceError('Compact exact replay requires a complete candidate universe.');
  }
  if (
    input.rawCandidates.length !== input.candidateUniverse.size ||
    input.candidateUniverse.captured !== input.candidateUniverse.size
  ) {
    throw new CompactTraceError('Candidate values do not match the declared universe.');
  }
  if (input.inputTokenIds.length === 0) {
    throw new CompactTraceError('A generation step requires at least one input token.');
  }
  if (input.seedReset !== undefined && input.seedReset !== null && input.prngStateBefore) {
    throw new CompactTraceError(
      'A seed reset and an explicit incoming cursor are mutually exclusive.',
    );
  }

  const normalised = orderedCandidates(input.rawCandidates);
  const values = Float32Array.from(normalised.candidates, (candidate) => candidate.logit);
  const payload = await createEmbeddedFloat32Payload(values);
  if (input.inference.logitsSha256 !== null && input.inference.logitsSha256 !== payload.sha256) {
    throw new CompactTraceError(
      'Inference logit identity differs from the canonical compact payload.',
    );
  }
  const seedReset = input.seedReset ?? null;
  const prngStateBefore = seedReset
    ? seedToState(seedReset)
    : (input.prngStateBefore ?? seedToState(input.config.seed));
  const interventions = input.interventions ?? {
    forcedTokenId: null,
    suppressedTokenIds: [],
  };
  const sampler = runSampler(normalised.candidates, input.config, interventions, prngStateBefore);
  const prngStateAfter = sampler.selection.draw?.stateAfter ?? prngStateBefore;

  return deepFreeze({
    payload,
    step: {
      candidateTokenIds: normalised.candidateTokenIds,
      candidateUniverse: input.candidateUniverse,
      createdOrder: input.createdOrder,
      decodedCandidates: decodedSnapshot(normalised.candidates, input.decodedCandidateLimit ?? 50),
      inference: input.inference,
      inputTokenIds: [...input.inputTokenIds],
      logitsRef: payload.sha256,
      position: input.inputTokenIds.length,
      sampler: {
        config: sampler.config,
        entropyBits: sampler.entropyBits,
        interventions: sampler.interventions,
        prngStateAfter,
        prngStateBefore,
        seedReset,
        selection: sampler.selection,
      },
    },
  });
}

function traceMap(bundle: CompactTraceBundle): Map<string, CompactTraceNode> {
  const map = new Map<string, CompactTraceNode>();
  for (const trace of bundle.traces) {
    if (map.has(trace.traceId)) throw new CompactTraceError(`Duplicate trace ID ${trace.traceId}.`);
    map.set(trace.traceId, trace);
  }
  return map;
}

export function resolveCompactTraceHistory(
  bundle: CompactTraceBundle,
  traceId = bundle.rootTraceId,
): readonly CompactGenerationStep[] {
  const traces = traceMap(bundle);
  const resolved = new Map<string, readonly CompactGenerationStep[]>();
  const visiting = new Set<string>();

  const visit = (id: string): readonly CompactGenerationStep[] => {
    const cached = resolved.get(id);
    if (cached) return cached;
    const trace = traces.get(id);
    if (!trace) throw new CompactTraceError(`Missing ancestor trace ${id}.`);
    if (visiting.has(id)) throw new CompactTraceError(`Trace ancestry contains a cycle at ${id}.`);
    visiting.add(id);
    let inherited: readonly CompactGenerationStep[] = [];
    if (trace.parent) {
      const parentHistory = visit(trace.parent.traceId);
      if (trace.parent.forkStep > parentHistory.length) {
        throw new CompactTraceError(
          `Trace ${id} forks at ${trace.parent.forkStep}, beyond its ancestor history.`,
        );
      }
      inherited = parentHistory.slice(0, trace.parent.forkStep);
    }
    trace.steps.forEach((step, index) => {
      if (step.createdOrder !== inherited.length + index) {
        throw new CompactTraceError(`Trace ${id} has a non-contiguous step order.`);
      }
    });
    const history = deepFreeze([...inherited, ...trace.steps]);
    visiting.delete(id);
    resolved.set(id, history);
    return history;
  };

  return visit(traceId);
}

function assertCompatibleParent(parent: CompactTraceNode, child: CompactTraceNode): void {
  const fields: Array<keyof CompactTraceNode> = [
    'calculationVersions',
    'mode',
    'model',
    'prompt',
    'promptTokens',
    'rootSeed',
    'tokenizer',
  ];
  for (const field of fields) {
    if (canonicalJson(parent[field]) !== canonicalJson(child[field])) {
      throw new CompactTraceError(
        `Trace ${child.traceId} is incompatible with its parent (${field}).`,
      );
    }
  }
}

export function validateCompactTraceBundle(bundle: CompactTraceBundle): CompactTraceBundle {
  const parsed = parseStructure(bundle);
  const traces = traceMap(parsed);
  if (!traces.has(parsed.rootTraceId)) {
    throw new CompactTraceError(`Root trace ${parsed.rootTraceId} is missing.`);
  }
  const totalSteps = parsed.traces.reduce((sum, trace) => sum + trace.steps.length, 0);
  if (totalSteps > COMPACT_TRACE_LIMITS.totalSteps) {
    throw new CompactTraceError(`Trace bundle exceeds ${COMPACT_TRACE_LIMITS.totalSteps} steps.`);
  }

  const referencedPayloads = new Set<string>();
  for (const trace of parsed.traces) {
    if (trace.parent) {
      const parent = traces.get(trace.parent.traceId);
      if (!parent) throw new CompactTraceError(`Missing ancestor trace ${trace.parent.traceId}.`);
      assertCompatibleParent(parent, trace);
    }
    const history = resolveCompactTraceHistory(parsed, trace.traceId);
    const inheritedLength = trace.parent?.forkStep ?? 0;
    for (const step of trace.steps) {
      const payload = parsed.payloads[step.logitsRef];
      if (!payload) throw new CompactTraceError(`Missing payload ${step.logitsRef}.`);
      if (payload.sha256 !== step.logitsRef) {
        throw new CompactTraceError('Payload map key does not match its SHA-256 identity.');
      }
      if (payload.valueCount !== step.candidateUniverse.size) {
        throw new CompactTraceError('Payload value count differs from the candidate universe.');
      }
      if (step.candidateTokenIds !== null && step.candidateTokenIds.length !== payload.valueCount) {
        throw new CompactTraceError('Candidate token ID count differs from the payload.');
      }
      if (step.inputTokenIds.length !== step.position) {
        throw new CompactTraceError('Step position differs from its input-token count.');
      }
      if (
        step.sampler.seedReset !== null &&
        (!sameState(step.sampler.prngStateBefore, seedToState(step.sampler.seedReset)) ||
          step.sampler.config.seed !== step.sampler.seedReset)
      ) {
        throw new CompactTraceError('Seed reset does not match the recorded sampler cursor.');
      }
      const selectedMode = step.sampler.selection.mode;
      if (
        selectedMode === 'sampled' &&
        (!step.sampler.selection.draw ||
          !sameState(step.sampler.selection.draw.stateBefore, step.sampler.prngStateBefore) ||
          !sameState(step.sampler.selection.draw.stateAfter, step.sampler.prngStateAfter))
      ) {
        throw new CompactTraceError('Sampled selection does not match the recorded PRNG cursor.');
      }
      if (
        selectedMode !== 'sampled' &&
        (step.sampler.selection.draw !== null ||
          !sameState(step.sampler.prngStateBefore, step.sampler.prngStateAfter))
      ) {
        throw new CompactTraceError('Non-sampled selection must preserve the PRNG cursor.');
      }
      referencedPayloads.add(step.logitsRef);
    }
    const promptIds = trace.promptTokens.map((token) => token.tokenId);
    history.forEach((step, index) => {
      const expectedInput = [
        ...promptIds,
        ...history.slice(0, index).map((item) => item.sampler.selection.tokenId),
      ];
      if (canonicalJson(step.inputTokenIds) !== canonicalJson(expectedInput)) {
        throw new CompactTraceError(
          `Trace ${trace.traceId} step ${index} does not continue its exact token prefix.`,
        );
      }
    });
    for (const annotation of trace.annotations) {
      if (annotation.step !== null && annotation.step >= inheritedLength + trace.steps.length) {
        throw new CompactTraceError(`Annotation ${annotation.id} points beyond its trace history.`);
      }
    }
  }

  const payloadEntries = Object.entries(parsed.payloads);
  if (payloadEntries.length > COMPACT_TRACE_LIMITS.payloadCount) {
    throw new CompactTraceError(
      `Trace bundle exceeds ${COMPACT_TRACE_LIMITS.payloadCount} payloads.`,
    );
  }
  let totalValues = 0;
  for (const [sha256, payload] of payloadEntries) {
    if (payload.sha256 !== sha256) {
      throw new CompactTraceError('Payload map key does not match its SHA-256 identity.');
    }
    if (!referencedPayloads.has(sha256)) {
      throw new CompactTraceError(`Payload ${sha256} is not referenced by any trace step.`);
    }
    totalValues += payload.valueCount;
  }
  if (totalValues > COMPACT_TRACE_LIMITS.totalFloat32Values) {
    throw new CompactTraceError(
      `Trace bundle exceeds ${COMPACT_TRACE_LIMITS.totalFloat32Values} float32 values.`,
    );
  }
  return parsed;
}

export function appendCompactGenerationStep(
  bundle: CompactTraceBundle,
  traceId: string,
  value: CompactStepWithPayload,
): CompactTraceBundle {
  const current = validateCompactTraceBundle(bundle);
  const trace = current.traces.find((item) => item.traceId === traceId);
  if (!trace) throw new CompactTraceError(`Trace ${traceId} does not exist.`);
  const history = resolveCompactTraceHistory(current, traceId);
  if (value.step.createdOrder !== history.length) {
    throw new CompactTraceError(`Next step order must be ${history.length}.`);
  }
  const expectedInput = [
    ...trace.promptTokens.map((token) => token.tokenId),
    ...history.map((step) => step.sampler.selection.tokenId),
  ];
  if (canonicalJson(expectedInput) !== canonicalJson(value.step.inputTokenIds)) {
    throw new CompactTraceError('Next step does not continue the effective trace prefix.');
  }
  const existing = current.payloads[value.payload.sha256];
  if (existing && canonicalJson(existing) !== canonicalJson(value.payload)) {
    throw new CompactTraceError('A content address resolved to different payload bytes.');
  }
  return validateCompactTraceBundle({
    ...current,
    exportedAt: new Date().toISOString(),
    payloads: { ...current.payloads, [value.payload.sha256]: value.payload },
    traces: current.traces.map((item) =>
      item.traceId === traceId ? { ...item, steps: [...item.steps, value.step] } : item,
    ),
  });
}

export function appendCompactTraceAnnotation(
  bundle: CompactTraceBundle,
  traceId: string,
  annotation: Omit<TraceAnnotation, 'createdAt' | 'id'> & {
    readonly createdAt?: string;
    readonly id?: string;
  },
): CompactTraceBundle {
  const current = validateCompactTraceBundle(bundle);
  const trace = current.traces.find((item) => item.traceId === traceId);
  if (!trace) throw new CompactTraceError(`Trace ${traceId} does not exist.`);
  const historyLength = resolveCompactTraceHistory(current, traceId).length;
  if (annotation.step !== null && annotation.step >= historyLength) {
    throw new CompactTraceError(`Annotation step must be below ${historyLength}.`);
  }
  const nextAnnotation: TraceAnnotation = {
    note: annotation.note,
    step: annotation.step,
    createdAt: annotation.createdAt ?? new Date().toISOString(),
    id: annotation.id ?? defaultId(),
  };
  return validateCompactTraceBundle({
    ...current,
    exportedAt: new Date().toISOString(),
    traces: current.traces.map((item) =>
      item.traceId === traceId
        ? { ...item, annotations: [...item.annotations, nextAnnotation] }
        : item,
    ),
  });
}

export interface ForkCompactTraceInput {
  readonly createdAt?: string;
  readonly forkStep: number;
  readonly title: string;
  readonly traceId?: string;
}

export function forkCompactTrace(
  bundle: CompactTraceBundle,
  parentTraceId: string,
  input: ForkCompactTraceInput,
): CompactTraceBundle {
  const current = validateCompactTraceBundle(bundle);
  const parent = current.traces.find((trace) => trace.traceId === parentTraceId);
  if (!parent) throw new CompactTraceError(`Parent trace ${parentTraceId} does not exist.`);
  const history = resolveCompactTraceHistory(current, parentTraceId);
  if (input.forkStep < 0 || input.forkStep > history.length) {
    throw new CompactTraceError('Fork step must fall within the effective parent history.');
  }
  const traceId = input.traceId ?? defaultId();
  if (current.traces.some((trace) => trace.traceId === traceId)) {
    throw new CompactTraceError(`Trace ${traceId} already exists.`);
  }
  const child: CompactTraceNode = {
    ...parent,
    annotations: [],
    createdAt: input.createdAt ?? new Date().toISOString(),
    parent: { forkStep: input.forkStep, traceId: parentTraceId },
    steps: [],
    title: input.title,
    traceId,
  };
  return validateCompactTraceBundle({
    ...current,
    exportedAt: new Date().toISOString(),
    rootTraceId: traceId,
    traces: [...current.traces, child],
  });
}

export function selectCompactTrace(
  bundle: CompactTraceBundle,
  traceId: string,
): CompactTraceBundle {
  if (!bundle.traces.some((trace) => trace.traceId === traceId)) {
    throw new CompactTraceError(`Trace ${traceId} does not exist.`);
  }
  return deepFreeze({ ...bundle, rootTraceId: traceId });
}

export async function resampleCompactGenerationStep(
  bundle: CompactTraceBundle,
  source: CompactGenerationStep,
  input: {
    readonly config?: SamplerConfig;
    readonly createdOrder: number;
    readonly interventions?: SamplerInterventions;
    readonly prngStateBefore?: PrngState;
    readonly seedReset?: string | null;
  },
): Promise<CompactStepWithPayload> {
  const payload = bundle.payloads[source.logitsRef];
  if (!payload) throw new CompactTraceError(`Missing payload ${source.logitsRef}.`);
  const values = await decodeEmbeddedFloat32Payload(payload);
  return createCompactGenerationStep({
    candidateUniverse: source.candidateUniverse,
    config: input.config ?? source.sampler.config,
    createdOrder: input.createdOrder,
    decodedCandidateLimit: Math.max(1, source.decodedCandidates.length),
    inference: source.inference,
    inputTokenIds: source.inputTokenIds,
    interventions: input.interventions ?? source.sampler.interventions,
    ...(input.prngStateBefore ? { prngStateBefore: input.prngStateBefore } : {}),
    rawCandidates: rawCandidatesFromValues(source, values),
    seedReset: input.seedReset ?? null,
  });
}

export async function replayCompactGenerationStep(
  step: CompactGenerationStep,
  payload: EmbeddedFloat32Payload,
): Promise<CompactStepReplayResult> {
  const reasons: string[] = [];
  try {
    const values = await decodeEmbeddedFloat32Payload(payload);
    const replayed = runSampler(
      rawCandidatesFromValues(step, values),
      step.sampler.config,
      step.sampler.interventions,
      step.sampler.prngStateBefore,
    );
    const snapshot: CompactSamplerRecord = {
      config: replayed.config,
      entropyBits: replayed.entropyBits,
      interventions: replayed.interventions,
      prngStateAfter: replayed.selection.draw?.stateAfter ?? step.sampler.prngStateBefore,
      prngStateBefore: step.sampler.prngStateBefore,
      seedReset: step.sampler.seedReset,
      selection: replayed.selection,
    };
    if (canonicalJson(snapshot) !== canonicalJson(step.sampler)) {
      reasons.push('recomputed compact sampler record differs');
    }
    if (step.inference.logitsSha256 !== null && step.inference.logitsSha256 !== payload.sha256) {
      reasons.push('inference logit identity differs from payload');
    }
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'payload replay failed');
  }
  return deepFreeze({ matches: reasons.length === 0, position: step.position, reasons });
}

export async function replayCompactTraceBundle(
  bundle: CompactTraceBundle,
  traceId = bundle.rootTraceId,
): Promise<CompactBundleReplayResult> {
  const current = validateCompactTraceBundle(bundle);
  const history = resolveCompactTraceHistory(current, traceId);
  const steps = await Promise.all(
    history.map((step) => {
      const payload = current.payloads[step.logitsRef];
      if (!payload) throw new CompactTraceError(`Missing payload ${step.logitsRef}.`);
      return replayCompactGenerationStep(step, payload);
    }),
  );
  return deepFreeze({
    matches: steps.every((step) => step.matches),
    steps,
    traceId,
  });
}

export async function parseCompactTraceBundleJson(json: string): Promise<CompactTraceBundle> {
  if (new TextEncoder().encode(json).byteLength > COMPACT_TRACE_LIMITS.importBytes) {
    throw new CompactTraceError(`Trace import exceeds ${COMPACT_TRACE_LIMITS.importBytes} bytes.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (error) {
    throw new CompactTraceError(
      `Trace is not valid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
    );
  }
  const bundle = validateCompactTraceBundle(parseStructure(value));
  for (const payload of Object.values(bundle.payloads)) {
    await decodeEmbeddedFloat32Payload(payload);
  }
  for (const trace of bundle.traces) {
    for (const step of trace.steps) {
      const payload = bundle.payloads[step.logitsRef];
      if (!payload) throw new CompactTraceError(`Missing payload ${step.logitsRef}.`);
      const replay = await replayCompactGenerationStep(step, payload);
      if (!replay.matches) {
        throw new CompactTraceError(
          `Trace ${trace.traceId} step ${step.createdOrder} failed deterministic replay: ${replay.reasons.join('; ')}`,
        );
      }
    }
  }
  return bundle;
}

export function serialiseCompactTraceBundle(bundle: CompactTraceBundle): string {
  return `${JSON.stringify(validateCompactTraceBundle(bundle), null, 2)}\n`;
}

export function compareCompactTraceSelections(
  bundle: CompactTraceBundle,
  leftTraceId: string,
  rightTraceId: string,
): { readonly firstDivergenceStep: number | null; readonly sharedSteps: number } {
  const left = resolveCompactTraceHistory(bundle, leftTraceId);
  const right = resolveCompactTraceHistory(bundle, rightTraceId);
  const sharedSteps = Math.min(left.length, right.length);
  let firstDivergenceStep: number | null = null;
  for (let index = 0; index < sharedSteps; index += 1) {
    if (left[index]?.sampler.selection.tokenId !== right[index]?.sampler.selection.tokenId) {
      firstDivergenceStep = index;
      break;
    }
  }
  return deepFreeze({ firstDivergenceStep, sharedSteps });
}

/** Converts a self-contained 1.0/1.1 root trace after its expanded replay has succeeded. */
export async function convertLegacyTraceToCompact(
  trace: ExperimentTrace,
): Promise<CompactTraceBundle> {
  if (trace.parent) {
    throw new CompactTraceError(
      `Legacy child trace ${trace.traceId} is missing its ancestor; import the complete ancestry bundle.`,
    );
  }
  const rootSeed = trace.steps[0]?.sampler.config.seed ?? 'observatory-imported';
  let bundle = createCompactTraceBundle({
    createdAt: trace.createdAt,
    mode: trace.mode,
    model: trace.model,
    prompt: trace.prompt,
    promptTokens: trace.promptTokens,
    rootSeed,
    title: trace.title,
    tokenizer: trace.tokenizer,
    traceId: trace.traceId,
  });
  let cursor = seedToState(rootSeed);
  for (const [index, legacyStep] of trace.steps.entries()) {
    if (legacyStep.createdOrder !== index) {
      throw new CompactTraceError(
        `Legacy step ${index} has non-contiguous creation order ${legacyStep.createdOrder}.`,
      );
    }
    const ordered = orderedCandidates(
      legacyStep.sampler.candidates.map(({ logit, text, tokenId }) => ({ logit, text, tokenId })),
    ).candidates;
    const recordedBefore = legacyStep.sampler.selection.draw?.stateBefore ?? cursor;
    let seedReset: string | null = null;
    if (!sameState(recordedBefore, cursor)) {
      const resetState = seedToState(legacyStep.sampler.config.seed);
      if (!sameState(recordedBefore, resetState)) {
        throw new CompactTraceError(`Legacy step ${index} has an unexplained PRNG discontinuity.`);
      }
      seedReset = legacyStep.sampler.config.seed;
    }
    const replayed = runSampler(
      ordered,
      legacyStep.sampler.config,
      legacyStep.sampler.interventions,
      recordedBefore,
    );
    if (canonicalJson(replayed) !== canonicalJson(legacyStep.sampler)) {
      throw new CompactTraceError(`Legacy step ${index} failed expanded replay before migration.`);
    }
    const compact = await createCompactGenerationStep({
      candidateUniverse: legacyStep.candidateUniverse,
      config: legacyStep.sampler.config,
      createdOrder: index,
      decodedCandidateLimit: Math.min(
        COMPACT_TRACE_LIMITS.displayCandidatesPerStep,
        Math.max(1, legacyStep.sampler.candidates.filter((candidate) => candidate.text).length),
      ),
      inference: legacyStep.inference,
      inputTokenIds: legacyStep.inputTokenIds,
      interventions: legacyStep.sampler.interventions,
      rawCandidates: ordered,
      ...(seedReset ? { seedReset } : { prngStateBefore: recordedBefore }),
    });
    bundle = appendCompactGenerationStep(bundle, trace.traceId, compact);
    cursor = compact.step.sampler.prngStateAfter;
  }
  return bundle;
}
