#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDirectory = resolve(root, 'fixtures/model-golden/source-fp32');
const manifest = JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8'));
const accepted = JSON.parse(
  await readFile(resolve(root, 'model-tools/verification/wasm-fp32-report.json'), 'utf8'),
);
const rejected = JSON.parse(
  await readFile(resolve(root, 'model-tools/verification/wasm-int8-report.json'), 'utf8'),
);
const liveTrace = JSON.parse(
  await readFile(resolve(root, 'model-tools/verification/live-trace-report.json'), 'utf8'),
);
const compactPayload = JSON.parse(
  await readFile(
    resolve(root, 'model-tools/verification/compact-payload-spike-report.json'),
    'utf8',
  ),
);

const EXPECTED = {
  browserId: 'Xenova/distilgpt2',
  browserRevision: 'a41c10485c18a64b6606729b6a082330cbd8f49e',
  fp32Sha256: 'd605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c',
  int8Sha256: '80b02da4fe266412bc49c9955a518151c50f9bac062f596a875068492a21f080',
  sourceId: 'distilbert/distilgpt2',
  sourceRevision: '2290a62682d06624634c1f46a6ad5be0f47f38aa',
  tokenizerBundleSha256: 'fb803549cd431422aa2398fd669a1b2cff3ac8c57ff5843d9a65869a4df0b592',
  vocabularySize: 50_257,
};

function invariant(condition, message) {
  if (!condition) throw new Error(`Model fixture check failed: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalAssetSetSha256(records) {
  const canonical = JSON.stringify(
    [...records]
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      .map(({ path, sha256: assetSha256, sizeBytes }) => ({
        path,
        sha256: assetSha256,
        sizeBytes,
      })),
  );
  return sha256(canonical);
}

function float32(buffer) {
  invariant(buffer.byteLength % 4 === 0, 'a logit fixture has partial float32 bytes');
  const copy = Uint8Array.from(buffer);
  return new Float32Array(copy.buffer);
}

function topTokenIds(values, count) {
  return Array.from(values, (_, tokenId) => tokenId)
    .sort((left, right) => values[right] - values[left] || left - right)
    .slice(0, count);
}

function assertIdentity() {
  invariant(manifest.formatVersion === '1.0.0', 'unknown golden manifest format');
  invariant(manifest.browserRuntime.id === EXPECTED.browserId, 'browser model ID drifted');
  invariant(
    manifest.browserRuntime.revision === EXPECTED.browserRevision,
    'browser model revision drifted',
  );
  invariant(manifest.sourceFramework.id === EXPECTED.sourceId, 'source model ID drifted');
  invariant(
    manifest.sourceFramework.revision === EXPECTED.sourceRevision,
    'source model revision drifted',
  );

  const tokenizerPaths = new Set(manifest.browserRuntime.tokenizerBundle.includedPaths);
  const tokenizerAssets = manifest.browserRuntime.assets.filter((item) =>
    tokenizerPaths.has(item.path),
  );
  invariant(
    canonicalAssetSetSha256(tokenizerAssets) === EXPECTED.tokenizerBundleSha256,
    'tokenizer asset inventory drifted',
  );
  invariant(
    manifest.browserRuntime.tokenizerBundle.sha256 === EXPECTED.tokenizerBundleSha256,
    'tokenizer bundle hash is stale',
  );

  const fp32 = manifest.browserRuntime.targets.find((item) => item.dtype === 'fp32');
  const int8 = manifest.browserRuntime.targets.find((item) => item.dtype === 'int8');
  invariant(fp32?.asset.sha256 === EXPECTED.fp32Sha256, 'fp32 ONNX hash drifted');
  invariant(fp32?.verificationStatus === 'accepted', 'fp32 target is not accepted');
  invariant(int8?.asset.sha256 === EXPECTED.int8Sha256, 'int8 ONNX hash drifted');
  invariant(int8?.verificationStatus === 'rejected', 'int8 target is not rejected');
}

async function assertAcceptedCase(fixture, result, requirements) {
  invariant(result.acceptance.passed, `${fixture.id} is not accepted`);
  invariant(result.tokenizer.exact, `${fixture.id} tokenizer comparison failed`);
  invariant(
    JSON.stringify(result.tokenizer.observedTokenIds) === JSON.stringify(fixture.tokenIds),
    `${fixture.id} tokenizer IDs differ from the source fixture`,
  );
  invariant(result.causalMask.prefixMaxAbsolute === 0, `${fixture.id} causal prefix changed`);
  invariant(
    result.causalMask.finalPositionChangedMaxAbsolute > 0,
    `${fixture.id} future-token mutation did not exercise the final position`,
  );

  const sourceBytes = await readFile(resolve(sourceDirectory, fixture.logits.path));
  invariant(sha256(sourceBytes) === fixture.logits.sha256, `${fixture.id} source hash differs`);
  const observedPath = result.observedLogits.path;
  invariant(typeof observedPath === 'string', `${fixture.id} observed fixture path is absent`);
  const observedBytes = await readFile(resolve(root, observedPath));
  invariant(
    sha256(observedBytes) === result.observedLogits.sha256,
    `${fixture.id} observed hash differs`,
  );

  const source = float32(sourceBytes);
  const observed = float32(observedBytes);
  invariant(source.length === EXPECTED.vocabularySize, `${fixture.id} source vocabulary differs`);
  invariant(observed.length === source.length, `${fixture.id} observed vocabulary differs`);

  let absoluteSum = 0;
  let signedSum = 0;
  let maxAbsolute = 0;
  for (let index = 0; index < source.length; index += 1) {
    const difference = observed[index] - source[index];
    signedSum += difference;
    absoluteSum += Math.abs(difference);
    maxAbsolute = Math.max(maxAbsolute, Math.abs(difference));
  }
  const meanAbsolute = absoluteSum / source.length;
  const offset = signedSum / source.length;
  let centredAbsoluteSum = 0;
  let maxCentredAbsolute = 0;
  for (let index = 0; index < source.length; index += 1) {
    const difference = Math.abs(observed[index] - source[index] - offset);
    centredAbsoluteSum += difference;
    maxCentredAbsolute = Math.max(maxCentredAbsolute, difference);
  }
  const meanCentredAbsolute = centredAbsoluteSum / source.length;
  invariant(maxAbsolute <= requirements.maxAbsoluteError, `${fixture.id} max error exceeds gate`);
  invariant(
    meanAbsolute <= requirements.meanAbsoluteError,
    `${fixture.id} mean error exceeds gate`,
  );
  invariant(
    maxCentredAbsolute <= requirements.maxCentredAbsoluteError,
    `${fixture.id} centred max error exceeds gate`,
  );
  invariant(
    meanCentredAbsolute <= requirements.meanCentredAbsoluteError,
    `${fixture.id} centred mean error exceeds gate`,
  );

  const sourceTop50 = topTokenIds(source, 50);
  const observedTop50 = topTokenIds(observed, 50);
  const observedSet = new Set(observedTop50);
  const overlap = sourceTop50.filter((tokenId) => observedSet.has(tokenId)).length / 50;
  invariant(overlap >= requirements.minimumTop50Overlap, `${fixture.id} top-50 overlap failed`);
  invariant(
    !requirements.requireTop1Match || sourceTop50[0] === observedTop50[0],
    `${fixture.id} top-1 token differs`,
  );
}

assertIdentity();
invariant(accepted.reportFormatVersion === '1.0.0', 'accepted report format is unknown');
invariant(accepted.accepted, 'fp32 WASM report is not accepted');
invariant(accepted.backend.model.sha256 === EXPECTED.fp32Sha256, 'accepted report asset differs');
invariant(
  accepted.toleranceProfile.profileId === 'distilgpt2-wasm-fp32-v1',
  'accepted tolerance profile drifted',
);
invariant(accepted.cases.length === manifest.cases.length, 'accepted case count differs');

for (const fixture of manifest.cases) {
  const result = accepted.cases.find((item) => item.fixtureId === fixture.id);
  invariant(result, `${fixture.id} is absent from the accepted report`);
  await assertAcceptedCase(fixture, result, accepted.toleranceProfile.requirements);
}

invariant(rejected.reportFormatVersion === '1.0.0', 'rejected report format is unknown');
invariant(!rejected.accepted, 'int8 WASM report unexpectedly passed');
invariant(rejected.backend.model.sha256 === EXPECTED.int8Sha256, 'rejected report asset differs');
invariant(
  rejected.toleranceProfile.profileId === 'distilgpt2-wasm-int8-v1',
  'rejected tolerance profile drifted',
);
invariant(
  rejected.cases.some((item) => !item.metrics.ranking.top1Match),
  'int8 report no longer records a top-1 failure',
);
invariant(
  rejected.cases.some((item) => item.causalMask.prefixMaxAbsolute > 0),
  'int8 report no longer records a causal-prefix failure',
);
invariant(
  rejected.cases.every((item) => item.tokenizer.exact),
  'int8 rejection is confounded by tokenizer drift',
);

invariant(liveTrace.reportFormatVersion === '1.0.0', 'live trace report format is unknown');
invariant(liveTrace.schemaVersion === '1.1.0', 'live trace schema evidence drifted');
invariant(liveTrace.candidateRecords === EXPECTED.vocabularySize, 'live trace is truncated');
invariant(liveTrace.replayMatches, 'recorded live trace replay failed');
invariant(
  liveTrace.sourceLogitsSha256 ===
    accepted.cases.find((item) => item.fixtureId === 'hero')?.observedLogits.sha256,
  'live trace does not use the accepted hero logits',
);
invariant(
  liveTrace.verificationProfileId === accepted.toleranceProfile.profileId,
  'live trace verification profile differs',
);
invariant(compactPayload.reportFormatVersion === '1.0.0', 'compact report format is unknown');
invariant(compactPayload.valueCount === EXPECTED.vocabularySize, 'compact payload is truncated');
invariant(compactPayload.exactSamplerMatch, 'compact payload changed the sampler result');
invariant(
  compactPayload.contentAddress === liveTrace.sourceLogitsSha256,
  'compact payload content address differs from the accepted hero vector',
);
invariant(
  compactPayload.expandedTraceJsonBytes === liveTrace.jsonBytes,
  'compact report compares against stale expanded-trace evidence',
);
invariant(compactPayload.reductionRatio > 0.98, 'compact payload did not reduce JSON by 98%');

console.log(
  `Verified ${manifest.cases.length} source/WASM pairs, the int8 rejection and compact-payload evidence.`,
);
