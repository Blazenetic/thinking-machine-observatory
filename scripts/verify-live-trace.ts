import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import type { PredictionCapture, RawCandidate } from '../packages/domain/src/index.ts';
import {
  DISTILGPT2_ASSETS,
  DISTILGPT2_MODEL,
  DISTILGPT2_RUNTIME,
  DISTILGPT2_VERIFICATION,
} from '../packages/inference-worker/src/index.ts';
import { parseTraceJson, replayTrace, serialiseTrace } from '../packages/trace-schema/src/index.ts';

import { createLiveTrace } from '../apps/observatory/src/data/live.ts';

interface GoldenCase {
  readonly id: string;
  readonly prompt: string;
  readonly tokens: PredictionCapture['promptTokens'];
  readonly top50: readonly { readonly text: string; readonly tokenId: number }[];
}

interface GoldenManifest {
  readonly cases: readonly GoldenCase[];
}

interface VerificationCase {
  readonly acceptance: { readonly passed: boolean };
  readonly fixtureId: string;
  readonly inferenceDurationMs: number;
  readonly observedLogits: {
    readonly path: string | null;
    readonly sha256: string;
  };
}

interface VerificationReport {
  readonly cases: readonly VerificationCase[];
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Live trace verification failed: ${message}`);
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function toFloat32(buffer: Buffer): Float32Array {
  invariant(buffer.byteLength % 4 === 0, 'the observed fixture has partial float32 bytes');
  const copy = Uint8Array.from(buffer);
  return new Float32Array(copy.buffer);
}

const manifest = JSON.parse(
  await readFile('fixtures/model-golden/source-fp32/manifest.json', 'utf8'),
) as GoldenManifest;
const verification = JSON.parse(
  await readFile('model-tools/verification/wasm-fp32-report.json', 'utf8'),
) as VerificationReport;
const hero = manifest.cases.find((item) => item.id === 'hero');
const observed = verification.cases.find((item) => item.fixtureId === 'hero');
invariant(hero && observed, 'hero golden evidence is missing');
invariant(observed.acceptance.passed, 'hero WASM evidence is not accepted');
invariant(observed.observedLogits.path, 'hero observed logit path is missing');

const logitBytes = await readFile(observed.observedLogits.path);
const logits = toFloat32(logitBytes);
invariant(logits.length === 50_257, 'hero vocabulary is not complete');
invariant(sha256(logitBytes) === observed.observedLogits.sha256, 'hero logit hash differs');

const candidates: RawCandidate[] = hero.top50.map((candidate) => ({
  logit: logits[candidate.tokenId] as number,
  text: candidate.text,
  tokenId: candidate.tokenId,
}));
const capture: PredictionCapture = {
  candidateUniverse: {
    captured: logits.length,
    complete: true,
    label: `Complete ${logits.length}-logit model vocabulary`,
    size: logits.length,
  },
  candidates,
  durationMs: observed.inferenceDurationMs,
  logits,
  logitsSha256: observed.observedLogits.sha256,
  mode: 'live-wasm',
  model: {
    assetHash: `sha256:${DISTILGPT2_ASSETS.wasmFp32.sha256}`,
    dtype: 'fp32',
    id: DISTILGPT2_MODEL.id,
    revision: DISTILGPT2_MODEL.revision,
    runtime: DISTILGPT2_RUNTIME,
    verificationStatus: 'verified',
  },
  promptTokens: hero.tokens,
  tokenizer: {
    assetHash: `sha256:${DISTILGPT2_ASSETS.tokenizerBundle.sha256}`,
    id: DISTILGPT2_MODEL.id,
    revision: DISTILGPT2_MODEL.revision,
  },
  verificationProfileId: DISTILGPT2_VERIFICATION.wasmFp32.profileId,
};

const heapBefore = process.memoryUsage().heapUsed;
const commitStartedAt = performance.now();
const trace = createLiveTrace(hero.prompt, capture, {
  createdAt: '2026-08-24T04:00:00.000Z',
  title: 'Verified live hero fixture',
  traceId: 'verified-live-hero-v1',
});
const commitDurationMs = performance.now() - commitStartedAt;

const serialiseStartedAt = performance.now();
const json = serialiseTrace(trace);
const serialiseDurationMs = performance.now() - serialiseStartedAt;
const gzipBytes = gzipSync(json, { level: 9 }).byteLength;

const replayStartedAt = performance.now();
const imported = parseTraceJson(json);
const replay = replayTrace(imported);
const replayDurationMs = performance.now() - replayStartedAt;
const selectedToken = trace.steps[0]?.sampler.selection;
const importedToken = imported.steps[0]?.sampler.selection;

invariant(replay.matches, replay.steps.flatMap((step) => step.reasons).join('; '));
invariant(selectedToken?.tokenId === 3223, 'hero selected token is not the pinned 3223');
invariant(selectedToken?.text === ' dark', 'hero selected token text is not " dark"');
invariant(selectedToken?.tokenId === importedToken?.tokenId, 'selected token ID changed');
invariant(selectedToken?.text === importedToken?.text, 'selected token text changed');
invariant(
  imported.steps[0]?.inference.logitsSha256 === capture.logitsSha256,
  'logit evidence hash changed',
);

const report = {
  candidateRecords: trace.steps[0]?.sampler.candidates.length,
  commitDurationMs,
  environment: {
    architecture: process.arch,
    node: process.version,
    platform: process.platform,
  },
  gzipBytes,
  heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
  jsonBytes: Buffer.byteLength(json),
  replayDurationMs,
  replayMatches: replay.matches,
  reportFormatVersion: '1.0.0',
  schemaVersion: trace.schemaVersion,
  selectedToken: {
    probability: selectedToken?.probability,
    text: selectedToken?.text,
    tokenId: selectedToken?.tokenId,
  },
  serialiseDurationMs,
  sourceLogitsSha256: capture.logitsSha256,
  traceId: trace.traceId,
  verificationProfileId: capture.verificationProfileId,
};

if (process.argv.includes('--write-report')) {
  await writeFile(
    'model-tools/verification/live-trace-report.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

console.log(
  `Live trace replayed token ${selectedToken?.tokenId} (${JSON.stringify(selectedToken?.text)}) ` +
    `from ${logits.length} logits; JSON ${(report.jsonBytes / 1024 / 1024).toFixed(2)} MiB, ` +
    `gzip ${(gzipBytes / 1024 / 1024).toFixed(2)} MiB.`,
);
