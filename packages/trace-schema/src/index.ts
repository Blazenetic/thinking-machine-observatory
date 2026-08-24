import {
  SAMPLER_CALCULATION_VERSION,
  TRACE_SCHEMA_VERSION,
  type ExperimentTrace,
  type GenerationStep,
  type ModelIdentity,
  type TokenizerIdentity,
  type TraceAnnotation,
} from '@observatory/domain';
import { z } from 'zod';

const EvidenceClassSchema = z.enum([
  'measured',
  'derived',
  'projected',
  'probed',
  'interventional',
]);
const ExecutionModeSchema = z.enum(['illustrative-demo', 'live-wasm', 'live-webgpu']);
const VerificationStatusSchema = z.enum(['illustrative', 'unverified', 'verified']);

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
  verificationStatus: VerificationStatusSchema,
}).strict();

const TokenSpecimenSchema = z
  .object({
    byteValues: z.array(z.number().int().min(0).max(255)),
    position: z.number().int().nonnegative(),
    text: z.string(),
    tokenId: z.number().int(),
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

const SamplerInterventionsSchema = z
  .object({
    forcedTokenId: z.number().int().nullable(),
    suppressedTokenIds: z.array(z.number().int()),
  })
  .strict();

const CandidateRecordSchema = z
  .object({
    cumulativeProbabilityBeforeTopP: z.number().finite().min(0).max(1).nullable(),
    eliminationReason: z.enum(['suppressed', 'top-k', 'top-p']).nullable(),
    finalProbability: z.number().finite().min(0).max(1),
    interval: z
      .tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)])
      .nullable(),
    logit: z.number().finite(),
    probabilityBeforeTopP: z.number().finite().min(0).max(1),
    rawRank: z.number().int().positive(),
    retainedByTopK: z.boolean(),
    retainedByTopP: z.boolean(),
    temperatureScaledLogit: z.number().finite().nullable(),
    text: z.string(),
    tokenId: z.number().int(),
  })
  .strict();

const PrngStateSchema = z.tuple([
  z.number().int().nonnegative().max(4_294_967_295),
  z.number().int().nonnegative().max(4_294_967_295),
  z.number().int().nonnegative().max(4_294_967_295),
  z.number().int().nonnegative().max(4_294_967_295),
]);

const SelectionRecordSchema = z
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

const GenerationStepSchema = z
  .object({
    candidateUniverse: z
      .object({
        captured: z.number().int().nonnegative(),
        complete: z.boolean(),
        label: z.string().min(1),
        size: z.number().int().positive(),
      })
      .strict(),
    createdOrder: z.number().int().nonnegative(),
    inference: z
      .object({
        durationMs: z.number().finite().nonnegative().nullable(),
        evidenceClass: EvidenceClassSchema,
        mode: ExecutionModeSchema,
        note: z.string().min(1),
        verificationStatus: VerificationStatusSchema,
      })
      .strict(),
    inputTokenIds: z.array(z.number().int()),
    position: z.number().int().nonnegative(),
    sampler: z
      .object({
        candidates: z.array(CandidateRecordSchema).min(1),
        config: SamplerConfigSchema,
        entropyBits: z.number().finite().nonnegative(),
        interventions: SamplerInterventionsSchema,
        selection: SelectionRecordSchema,
      })
      .strict(),
  })
  .strict();

const AnnotationSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: z.string().min(1),
    note: z.string().min(1),
    step: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const ExperimentTraceSchema = z
  .object({
    annotations: z.array(AnnotationSchema),
    calculationVersions: z
      .object({
        entropy: z.literal('bits-1'),
        sampler: z.literal(SAMPLER_CALCULATION_VERSION),
        softmax: z.literal('stable-1'),
      })
      .strict(),
    createdAt: z.iso.datetime(),
    mode: ExecutionModeSchema,
    model: ModelIdentitySchema,
    parent: z
      .object({
        forkStep: z.number().int().nonnegative(),
        traceId: z.string().min(1),
      })
      .strict()
      .nullable(),
    prompt: z.string().min(1),
    promptTokens: z.array(TokenSpecimenSchema).min(1),
    schemaVersion: z.literal(TRACE_SCHEMA_VERSION),
    steps: z.array(GenerationStepSchema),
    title: z.string().min(1),
    tokenizer: AssetIdentitySchema,
    traceId: z.string().min(1),
  })
  .strict();

export class TraceValidationError extends Error {
  public readonly issues: readonly z.core.$ZodIssue[];

  public constructor(message: string, issues: readonly z.core.$ZodIssue[] = []) {
    super(message);
    this.name = 'TraceValidationError';
    this.issues = issues;
  }
}

export interface CreateTraceInput {
  readonly createdAt?: string;
  readonly mode: ExperimentTrace['mode'];
  readonly model: ModelIdentity;
  readonly prompt: string;
  readonly promptTokens: ExperimentTrace['promptTokens'];
  readonly title: string;
  readonly tokenizer: TokenizerIdentity;
  readonly traceId?: string;
}

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

function validateAndFreeze(value: unknown): ExperimentTrace {
  const result = ExperimentTraceSchema.safeParse(value);
  if (!result.success) {
    throw new TraceValidationError('Trace did not satisfy schema 1.0.0.', result.error.issues);
  }
  return deepFreeze(result.data);
}

export function createTrace(input: CreateTraceInput): ExperimentTrace {
  return validateAndFreeze({
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
    schemaVersion: TRACE_SCHEMA_VERSION,
    steps: [],
    title: input.title,
    tokenizer: input.tokenizer,
    traceId: input.traceId ?? defaultId(),
  });
}

export function appendStep(trace: ExperimentTrace, step: GenerationStep): ExperimentTrace {
  const previousOrder = trace.steps.at(-1)?.createdOrder ?? -1;
  if (step.createdOrder <= previousOrder) {
    throw new TraceValidationError('Generation step order must increase monotonically.');
  }
  return validateAndFreeze({ ...trace, steps: [...trace.steps, step] });
}

export interface ForkTraceInput {
  readonly createdAt?: string;
  readonly forkStep: number;
  readonly title: string;
  readonly traceId?: string;
}

export function forkTrace(parent: ExperimentTrace, input: ForkTraceInput): ExperimentTrace {
  if (input.forkStep < 0 || input.forkStep > parent.steps.length) {
    throw new TraceValidationError('Fork step must fall within the parent trace.');
  }
  return validateAndFreeze({
    ...parent,
    annotations: [],
    createdAt: input.createdAt ?? new Date().toISOString(),
    parent: { forkStep: input.forkStep, traceId: parent.traceId },
    steps: [],
    title: input.title,
    traceId: input.traceId ?? defaultId(),
  });
}

export function addAnnotation(
  trace: ExperimentTrace,
  annotation: Omit<TraceAnnotation, 'createdAt' | 'id'> & {
    readonly createdAt?: string;
    readonly id?: string;
  },
): ExperimentTrace {
  return validateAndFreeze({
    ...trace,
    annotations: [
      ...trace.annotations,
      {
        ...annotation,
        createdAt: annotation.createdAt ?? new Date().toISOString(),
        id: annotation.id ?? defaultId(),
      },
    ],
  });
}

export function serialiseTrace(trace: ExperimentTrace): string {
  return `${JSON.stringify(validateAndFreeze(trace), null, 2)}\n`;
}

export function parseTraceJson(json: string): ExperimentTrace {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (error) {
    throw new TraceValidationError(
      `Trace is not valid JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
    );
  }
  return validateAndFreeze(value);
}

export interface TraceCompatibility {
  readonly compatible: boolean;
  readonly reasons: readonly string[];
}

export function compareTraceCompatibility(
  left: ExperimentTrace,
  right: ExperimentTrace,
): TraceCompatibility {
  const reasons: string[] = [];
  if (left.schemaVersion !== right.schemaVersion) reasons.push('schema version differs');
  if (left.model.id !== right.model.id || left.model.revision !== right.model.revision) {
    reasons.push('model build differs');
  }
  if (left.model.dtype !== right.model.dtype) reasons.push('model dtype differs');
  if (
    left.tokenizer.id !== right.tokenizer.id ||
    left.tokenizer.revision !== right.tokenizer.revision
  ) {
    reasons.push('tokenizer build differs');
  }
  if (left.calculationVersions.sampler !== right.calculationVersions.sampler) {
    reasons.push('sampler calculation version differs');
  }
  return deepFreeze({ compatible: reasons.length === 0, reasons });
}
