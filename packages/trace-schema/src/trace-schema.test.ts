import { describe, expect, it } from 'vitest';

import type { GenerationStep, ModelIdentity, TokenizerIdentity } from '@observatory/domain';
import { runSampler } from '@observatory/sampler';

import {
  addAnnotation,
  appendStep,
  compareTraceCompatibility,
  createTrace,
  forkTrace,
  parseTraceJson,
  replayGenerationStep,
  replayTrace,
  serialiseTrace,
  TraceValidationError,
} from './index';

const model: ModelIdentity = {
  assetHash: 'sha256:model',
  dtype: 'fixture',
  id: 'fixture-model',
  revision: '1',
  runtime: 'test',
  verificationStatus: 'illustrative',
};

const tokenizer: TokenizerIdentity = {
  assetHash: 'sha256:tokenizer',
  id: 'fixture-tokenizer',
  revision: '1',
};

function baseTrace() {
  return createTrace({
    createdAt: '2026-08-24T00:00:00.000Z',
    mode: 'illustrative-demo',
    model,
    prompt: 'The night sky was',
    promptTokens: [{ byteValues: [84, 104, 101], position: 0, text: 'The', tokenId: 1 }],
    title: 'Baseline',
    tokenizer,
    traceId: 'trace-baseline',
  });
}

function step(createdOrder = 0): GenerationStep {
  return {
    candidateUniverse: { captured: 2, complete: true, label: 'test fixture', size: 2 },
    createdOrder,
    inference: {
      durationMs: null,
      evidenceClass: 'derived',
      logitsSha256: null,
      mode: 'illustrative-demo',
      note: 'Illustrative fixture.',
      verificationProfileId: null,
      verificationStatus: 'illustrative',
    },
    inputTokenIds: [1],
    position: 1,
    sampler: runSampler(
      [
        { logit: 2, text: ' clear', tokenId: 2 },
        { logit: 1, text: ' dark', tokenId: 3 },
      ],
      { mode: 'greedy', seed: 'fixture', temperature: 1, topK: null, topP: 1 },
    ),
  };
}

describe('trace lifecycle', () => {
  it('round-trips a versioned trace and freezes parsed data', () => {
    const trace = appendStep(baseTrace(), step());
    const restored = parseTraceJson(serialiseTrace(trace));
    expect(restored).toEqual(trace);
    expect(Object.isFrozen(restored)).toBe(true);
    expect(Object.isFrozen(restored.steps)).toBe(true);
  });

  it('forks without mutating or duplicating the ancestor steps', () => {
    const parent = appendStep(baseTrace(), step());
    const before = serialiseTrace(parent);
    const child = forkTrace(parent, {
      createdAt: '2026-08-24T00:01:00.000Z',
      forkStep: 1,
      title: 'Runner-up',
      traceId: 'trace-runner-up',
    });
    const advancedChild = appendStep(child, step());

    expect(serialiseTrace(parent)).toBe(before);
    expect(child.parent).toEqual({ forkStep: 1, traceId: parent.traceId });
    expect(child.steps).toHaveLength(0);
    expect(advancedChild.steps).toHaveLength(1);
  });

  it('adds annotations as immutable values', () => {
    const original = baseTrace();
    const annotated = addAnnotation(original, {
      createdAt: '2026-08-24T00:02:00.000Z',
      id: 'note-1',
      note: 'The runner-up produces a darker continuation.',
      step: 0,
    });
    expect(original.annotations).toHaveLength(0);
    expect(annotated.annotations).toHaveLength(1);
  });

  it('rejects malformed JSON, unknown fields and broken step ordering', () => {
    expect(() => parseTraceJson('{')).toThrow(TraceValidationError);
    const unknownField = JSON.parse(serialiseTrace(baseTrace())) as Record<string, unknown>;
    unknownField.extra = true;
    expect(() => parseTraceJson(JSON.stringify(unknownField))).toThrow(TraceValidationError);
    const once = appendStep(baseTrace(), step(2));
    expect(() => appendStep(once, step(1))).toThrow(TraceValidationError);
  });

  it('reports model compatibility explicitly', () => {
    const left = baseTrace();
    const right = createTrace({
      createdAt: '2026-08-24T00:00:00.000Z',
      mode: 'illustrative-demo',
      model: { ...model, dtype: 'q8' },
      prompt: left.prompt,
      promptTokens: left.promptTokens,
      title: 'Other build',
      tokenizer,
      traceId: 'other',
    });
    expect(compareTraceCompatibility(left, right)).toEqual({
      compatible: false,
      reasons: ['model dtype differs'],
    });
  });

  it('replays a complete trace to the byte-equivalent sampler result', () => {
    const trace = appendStep(baseTrace(), step());
    expect(replayTrace(parseTraceJson(serialiseTrace(trace)))).toEqual({
      matches: true,
      steps: [{ matches: true, position: 1, reasons: [] }],
      traceId: trace.traceId,
    });
  });

  it('refuses replay when a capture is incomplete or a selection was changed', () => {
    const incomplete = {
      ...step(),
      candidateUniverse: { captured: 1, complete: false, label: 'top one', size: 2 },
    };
    expect(replayGenerationStep(incomplete)).toEqual({
      matches: false,
      position: 1,
      reasons: ['candidate universe is incomplete'],
    });

    const traceJson = JSON.parse(serialiseTrace(appendStep(baseTrace(), step()))) as {
      steps: Array<{ sampler: { selection: { tokenId: number } } }>;
    };
    const firstStep = traceJson.steps[0];
    if (!firstStep) throw new Error('Expected one test step.');
    firstStep.sampler.selection.tokenId = 99;
    expect(replayTrace(parseTraceJson(JSON.stringify(traceJson))).matches).toBe(false);
  });

  it('migrates a valid 1.0.0 trace without inventing verification evidence', () => {
    const legacy = JSON.parse(serialiseTrace(appendStep(baseTrace(), step()))) as {
      schemaVersion: string;
      steps: Array<{
        inference: {
          logitsSha256?: string | null;
          verificationProfileId?: string | null;
        };
      }>;
    };
    legacy.schemaVersion = '1.0.0';
    const legacyStep = legacy.steps[0];
    if (!legacyStep) throw new Error('Expected one legacy step.');
    delete legacyStep.inference.logitsSha256;
    delete legacyStep.inference.verificationProfileId;

    const migrated = parseTraceJson(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe('1.1.0');
    expect(migrated.steps[0]?.inference).toMatchObject({
      logitsSha256: null,
      verificationProfileId: null,
    });
  });
});
