import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync } from 'node:zlib';

import type { RawCandidate } from '../packages/domain/src/index.ts';
import { runSampler } from '../packages/sampler/src/index.ts';
import {
  createEmbeddedFloat32Payload,
  decodeEmbeddedFloat32Payload,
} from '../packages/trace-schema/src/logit-payload.ts';
import { VERIFIED_LIVE_CONFIG } from '../apps/observatory/src/data/live.ts';

interface GoldenManifest {
  readonly cases: readonly {
    readonly id: string;
    readonly top50: readonly { readonly text: string; readonly tokenId: number }[];
  }[];
}

interface VerificationReport {
  readonly cases: readonly {
    readonly fixtureId: string;
    readonly observedLogits: { readonly path: string | null; readonly sha256: string };
  }[];
}

interface LiveTraceReport {
  readonly jsonBytes: number;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Compact payload verification failed: ${message}`);
}

function toFloat32(buffer: Buffer): Float32Array {
  invariant(buffer.byteLength % 4 === 0, 'the accepted vector has partial float32 bytes');
  const bytes = Uint8Array.from(buffer);
  return new Float32Array(bytes.buffer);
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

const manifest = JSON.parse(
  await readFile('fixtures/model-golden/source-fp32/manifest.json', 'utf8'),
) as GoldenManifest;
const verification = JSON.parse(
  await readFile('model-tools/verification/wasm-fp32-report.json', 'utf8'),
) as VerificationReport;
const liveTrace = JSON.parse(
  await readFile('model-tools/verification/live-trace-report.json', 'utf8'),
) as LiveTraceReport;
const hero = manifest.cases.find((item) => item.id === 'hero');
const observed = verification.cases.find((item) => item.fixtureId === 'hero');
invariant(hero && observed?.observedLogits.path, 'accepted hero evidence is incomplete');

const logitBytes = await readFile(observed.observedLogits.path);
const logits = toFloat32(logitBytes);
const decodedText = new Map(hero.top50.map((candidate) => [candidate.tokenId, candidate.text]));
const candidates = (values: Float32Array): RawCandidate[] =>
  Array.from(values, (logit, tokenId) => ({
    logit,
    text: decodedText.get(tokenId) ?? '',
    tokenId,
  }));

const heapBefore = process.memoryUsage().heapUsed;
const encodeStartedAt = performance.now();
const payload = await createEmbeddedFloat32Payload(logits);
const encodeDurationMs = performance.now() - encodeStartedAt;
const payloadJson = `${JSON.stringify(payload)}\n`;

const decodeStartedAt = performance.now();
const restored = await decodeEmbeddedFloat32Payload(payload);
const decodeDurationMs = performance.now() - decodeStartedAt;
invariant(payload.sha256 === observed.observedLogits.sha256, 'content address changed');
invariant(sha256(logitBytes) === sha256(new Uint8Array(restored.buffer)), 'bytes changed');

const originalSampler = runSampler(candidates(logits), VERIFIED_LIVE_CONFIG);
const restoredSampler = runSampler(candidates(restored), VERIFIED_LIVE_CONFIG);
invariant(isDeepStrictEqual(originalSampler, restoredSampler), 'sampler result changed');

const payloadJsonBytes = Buffer.byteLength(payloadJson);
const payloadGzipBytes = gzipSync(payloadJson, { level: 9 }).byteLength;
const report = {
  contentAddress: payload.sha256,
  decodeDurationMs,
  encodeDurationMs,
  exactSamplerMatch: true,
  expandedTraceJsonBytes: liveTrace.jsonBytes,
  heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
  payloadGzipBytes,
  payloadJsonBytes,
  reductionRatio: 1 - payloadJsonBytes / liveTrace.jsonBytes,
  reportFormatVersion: '1.0.0',
  selectedToken: restoredSampler.selection,
  valueCount: restored.length,
};

if (process.argv.includes('--write-report')) {
  await writeFile(
    'model-tools/verification/compact-payload-spike-report.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

console.log(
  `Compact payload preserved token ${restoredSampler.selection.tokenId} and all sampler fields; ` +
    `${(payloadJsonBytes / 1024).toFixed(1)} KiB JSON versus ` +
    `${(liveTrace.jsonBytes / 1024 / 1024).toFixed(2)} MiB expanded ` +
    `(${(report.reductionRatio * 100).toFixed(2)}% smaller).`,
);
