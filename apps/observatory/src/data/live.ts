import type {
  ExperimentTrace,
  GenerationStep,
  PredictionCapture,
  RawCandidate,
  SamplerConfig,
} from '@observatory/domain';
import {
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_RUNTIME,
  DISTILGPT2_VERIFICATION,
} from '@observatory/inference-worker';
import { runSampler } from '@observatory/sampler';
import { appendStep, createTrace } from '@observatory/trace-schema';

export const VERIFIED_LIVE_CONFIG: SamplerConfig = {
  mode: 'sampled',
  seed: 'observatory-live-42',
  temperature: 0.8,
  topK: 40,
  topP: 0.95,
};

export class LiveTraceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'LiveTraceError';
  }
}

export interface CreateLiveTraceOptions {
  readonly config?: SamplerConfig;
  readonly createdAt?: string;
  readonly title?: string;
  readonly traceId?: string;
}

interface LiveIdentity {
  readonly mode: ExperimentTrace['mode'];
  readonly model: ExperimentTrace['model'];
  readonly tokenizer: ExperimentTrace['tokenizer'];
  readonly verificationProfileId: string | null;
}

function hasAcceptedIdentity(value: LiveIdentity): boolean {
  return (
    value.mode === 'live-wasm' &&
    value.model.assetHash === `sha256:${DISTILGPT2_ASSETS.wasmFp32.sha256}` &&
    value.model.dtype === 'fp32' &&
    value.model.id === DISTILGPT2_MODEL.id &&
    value.model.revision === DISTILGPT2_MODEL.revision &&
    value.model.runtime === DISTILGPT2_RUNTIME &&
    value.model.verificationStatus === 'verified' &&
    value.tokenizer.assetHash === `sha256:${DISTILGPT2_ASSETS.tokenizerBundle.sha256}` &&
    value.tokenizer.id === DISTILGPT2_MODEL.id &&
    value.tokenizer.revision === DISTILGPT2_MODEL.revision &&
    value.verificationProfileId === DISTILGPT2_VERIFICATION.wasmFp32.profileId
  );
}

/** Refuses self-declared "verified" traces from any build outside the accepted profile. */
export function assertAcceptedLiveTrace(trace: ExperimentTrace): void {
  const identity = {
    mode: trace.mode,
    model: trace.model,
    tokenizer: trace.tokenizer,
    verificationProfileId: trace.steps[0]?.inference.verificationProfileId ?? null,
  } satisfies LiveIdentity;
  if (!hasAcceptedIdentity(identity)) {
    throw new LiveTraceError('Trace identity does not match the accepted fp32 WASM profile.');
  }
  if (
    trace.steps.length === 0 ||
    trace.steps.some(
      (step) =>
        step.inference.verificationProfileId !== DISTILGPT2_VERIFICATION.wasmFp32.profileId ||
        step.inference.verificationStatus !== 'verified' ||
        step.inference.logitsSha256 === null,
    )
  ) {
    throw new LiveTraceError('Every live step requires verified, hashed inference evidence.');
  }
}

/** Turns one verified complete worker capture into an exact replayable trace. */
export function createLiveTrace(
  prompt: string,
  capture: PredictionCapture,
  options: CreateLiveTraceOptions = {},
): ExperimentTrace {
  if (!capture.candidateUniverse.complete) {
    throw new LiveTraceError('A live trace requires the complete vocabulary distribution.');
  }
  if (
    capture.logits.length !== capture.candidateUniverse.size ||
    capture.candidateUniverse.captured !== capture.candidateUniverse.size
  ) {
    throw new LiveTraceError('The logit vector does not match the declared candidate universe.');
  }
  if (!hasAcceptedIdentity(capture)) {
    throw new LiveTraceError('Only the accepted fp32 WASM build may enter exact live replay.');
  }

  const decoded = new Map(
    capture.candidates.map((candidate) => [candidate.tokenId, candidate.text]),
  );
  const candidates: RawCandidate[] = Array.from(capture.logits, (logit, tokenId) => ({
    logit,
    text: decoded.get(tokenId) ?? '',
    tokenId,
  }));
  const sampler = runSampler(candidates, options.config ?? VERIFIED_LIVE_CONFIG);
  const step: GenerationStep = {
    candidateUniverse: capture.candidateUniverse,
    createdOrder: 0,
    inference: {
      durationMs: capture.durationMs,
      evidenceClass: 'measured',
      logitsSha256: capture.logitsSha256,
      mode: capture.mode,
      note: 'Complete runtime logits measured from the pinned local build; sampler values are derived exactly.',
      verificationProfileId: capture.verificationProfileId,
      verificationStatus: capture.model.verificationStatus,
    },
    inputTokenIds: capture.promptTokens.map((token) => token.tokenId),
    position: capture.promptTokens.length,
    sampler,
  };
  const trace = createTrace({
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    mode: capture.mode,
    model: capture.model,
    prompt,
    promptTokens: capture.promptTokens,
    title:
      options.title ?? `Verified live · ${sampler.selection.text || sampler.selection.tokenId}`,
    tokenizer: capture.tokenizer,
    ...(options.traceId ? { traceId: options.traceId } : {}),
  });
  const committed = appendStep(trace, step);
  assertAcceptedLiveTrace(committed);
  return committed;
}
