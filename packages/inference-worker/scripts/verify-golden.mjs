#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, platform, release } from 'node:os';
import { relative, resolve } from 'node:path';

import { AutoTokenizer, env as transformersEnvironment } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';

const MODEL_VARIANTS = {
  fp32: {
    assetPath: 'onnx/model.onnx',
    reportName: 'wasm-fp32-report.json',
    sha256: 'd605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c',
    toleranceName: 'wasm-fp32-tolerance.json',
  },
  int8: {
    assetPath: 'onnx/model_int8.onnx',
    reportName: 'wasm-int8-report.json',
    sha256: '80b02da4fe266412bc49c9955a518151c50f9bac062f596a875068492a21f080',
    toleranceName: 'wasm-int8-tolerance.json',
  },
};
const MODEL = {
  id: 'Xenova/distilgpt2',
  revision: 'a41c10485c18a64b6606729b6a082330cbd8f49e',
};

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const variantName = argumentValue('--variant', 'fp32');
const variant = MODEL_VARIANTS[variantName];
if (!variant) {
  throw new Error(`Unknown model variant ${variantName}. Choose fp32 or int8.`);
}

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const fixtureDirectory = resolve(repositoryRoot, 'fixtures/model-golden/source-fp32');
const tolerancePath = resolve(repositoryRoot, `model-tools/verification/${variant.toleranceName}`);
const reportPath = resolve(repositoryRoot, `model-tools/verification/${variant.reportName}`);
const modelPath =
  process.env.OBSERVATORY_ONNX_MODEL ??
  process.env[`OBSERVATORY_ONNX_MODEL_${variantName.toUpperCase()}`];
const observedDirectory = argumentValue('--write-observed-dir', null);
const expectRejection = process.argv.includes('--expect-rejection');

if (!modelPath) {
  throw new Error(
    `Set OBSERVATORY_ONNX_MODEL to the pinned ${variant.assetPath} asset before verification.`,
  );
}

transformersEnvironment.cacheDir =
  process.env.OBSERVATORY_TRANSFORMERS_CACHE ?? '/tmp/observatory-transformers-js-cache';
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function float32FromBuffer(buffer) {
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error('Golden logit fixture is not a complete float32 vector.');
  }
  const copy = Uint8Array.from(buffer);
  return new Float32Array(copy.buffer);
}

function createFeeds(tokenIds) {
  const feeds = {
    attention_mask: new ort.Tensor(
      'int64',
      BigInt64Array.from(tokenIds, () => 1n),
      [1, tokenIds.length],
    ),
    input_ids: new ort.Tensor('int64', BigInt64Array.from(tokenIds, BigInt), [1, tokenIds.length]),
    position_ids: new ort.Tensor(
      'int64',
      BigInt64Array.from(tokenIds, (_, index) => BigInt(index)),
      [1, tokenIds.length],
    ),
  };

  for (let layer = 0; layer < 6; layer += 1) {
    for (const kind of ['key', 'value']) {
      feeds[`past_key_values.${layer}.${kind}`] = new ort.Tensor(
        'float32',
        new Float32Array(0),
        [1, 12, 0, 64],
      );
    }
  }
  return feeds;
}

async function runModel(session, tokenIds) {
  const startedAt = performance.now();
  const output = await session.run(createFeeds(tokenIds));
  const durationMs = performance.now() - startedAt;
  const logits = output.logits;
  if (!logits || logits.dims.length !== 3) {
    throw new Error('Expected [batch, sequence, vocabulary] logits from the ONNX graph.');
  }
  return { durationMs, logits };
}

function finalLogits(tensor) {
  const vocabularySize = tensor.dims.at(-1);
  const sequenceLength = tensor.dims.at(-2);
  const offset = (sequenceLength - 1) * vocabularySize;
  return Float32Array.from(
    Array.from({ length: vocabularySize }, (_, tokenId) => tensor.data[offset + tokenId]),
  );
}

function descendingOrder(values) {
  return Array.from(values, (_, tokenId) => tokenId).sort(
    (left, right) => values[right] - values[left] || left - right,
  );
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compareLogits(reference, observed) {
  if (reference.length !== observed.length) {
    throw new Error(
      `Vocabulary mismatch: ${reference.length} reference, ${observed.length} observed.`,
    );
  }

  const differences = Array.from(reference, (value, index) => observed[index] - value);
  const absolute = differences.map(Math.abs);
  const offset = mean(differences);
  const centredAbsolute = differences.map((difference) => Math.abs(difference - offset));
  const relative = absolute.map(
    (difference, index) => difference / Math.max(Math.abs(reference[index]), 1e-12),
  );
  const referenceOrder = descendingOrder(reference);
  const observedOrder = descendingOrder(observed);
  const referenceTop50 = referenceOrder.slice(0, 50);
  const observedTop50 = observedOrder.slice(0, 50);
  const observedTop50Set = new Set(observedTop50);
  const overlap = referenceTop50.filter((tokenId) => observedTop50Set.has(tokenId));
  const observedRanks = new Int32Array(observed.length);
  observedOrder.forEach((tokenId, rank) => {
    observedRanks[tokenId] = rank;
  });

  return {
    logitError: {
      additiveOffset: offset,
      maxAbsolute: Math.max(...absolute),
      maxCentredAbsolute: Math.max(...centredAbsolute),
      maxRelative: Math.max(...relative),
      meanAbsolute: mean(absolute),
      meanCentredAbsolute: mean(centredAbsolute),
      meanRelative: mean(relative),
      rootMeanSquare: Math.sqrt(mean(differences.map((value) => value * value))),
    },
    ranking: {
      meanReferenceTop50Displacement: mean(
        referenceTop50.map((tokenId, rank) => Math.abs(observedRanks[tokenId] - rank)),
      ),
      top1Match: referenceOrder[0] === observedOrder[0],
      top10Overlap: referenceOrder
        .slice(0, 10)
        .filter((tokenId) => new Set(observedOrder.slice(0, 10)).has(tokenId)).length,
      top40BoundaryOverlap: referenceOrder
        .slice(0, 40)
        .filter((tokenId) => new Set(observedOrder.slice(0, 40)).has(tokenId)).length,
      top50ExactPositions: referenceTop50.filter(
        (tokenId, index) => observedTop50[index] === tokenId,
      ).length,
      top50Overlap: overlap.length,
      top50OverlapRatio: overlap.length / 50,
    },
  };
}

function compareCausalPrefix(referenceRun, mutatedRun) {
  const sequenceLength = referenceRun.dims.at(-2);
  const vocabularySize = referenceRun.dims.at(-1);
  let prefixMaxAbsolute = 0;
  let finalPositionChangedMaxAbsolute = 0;
  for (let position = 0; position < sequenceLength; position += 1) {
    for (let tokenId = 0; tokenId < vocabularySize; tokenId += 1) {
      const index = position * vocabularySize + tokenId;
      const difference = Math.abs(referenceRun.data[index] - mutatedRun.data[index]);
      if (position === sequenceLength - 1) {
        finalPositionChangedMaxAbsolute = Math.max(finalPositionChangedMaxAbsolute, difference);
      } else {
        prefixMaxAbsolute = Math.max(prefixMaxAbsolute, difference);
      }
    }
  }
  return { finalPositionChangedMaxAbsolute, prefixMaxAbsolute };
}

function evaluateCase(result, requirements) {
  const failures = [];
  if (!result.tokenizer.exact && requirements.requireExactTokenizer) {
    failures.push('tokenizer IDs or fragments differ');
  }
  if (!result.metrics.ranking.top1Match && requirements.requireTop1Match) {
    failures.push('top-1 token differs');
  }
  if (result.metrics.ranking.top50OverlapRatio < requirements.minimumTop50Overlap) {
    failures.push('top-50 overlap is below tolerance');
  }
  if (result.metrics.logitError.maxAbsolute > requirements.maxAbsoluteError) {
    failures.push('maximum raw absolute logit error exceeds tolerance');
  }
  if (result.metrics.logitError.meanAbsolute > requirements.meanAbsoluteError) {
    failures.push('mean raw absolute logit error exceeds tolerance');
  }
  if (result.metrics.logitError.maxCentredAbsolute > requirements.maxCentredAbsoluteError) {
    failures.push('maximum shift-aligned logit error exceeds tolerance');
  }
  if (result.metrics.logitError.meanCentredAbsolute > requirements.meanCentredAbsoluteError) {
    failures.push('mean shift-aligned logit error exceeds tolerance');
  }
  if (result.causalMask.prefixMaxAbsolute > requirements.causalPrefixMaxAbsoluteError) {
    failures.push('causal prefix changed after a future-token mutation');
  }
  return { failures, passed: failures.length === 0 };
}

const manifest = JSON.parse(await readFile(resolve(fixtureDirectory, 'manifest.json'), 'utf8'));
const tolerance = JSON.parse(await readFile(tolerancePath, 'utf8'));
const modelBytes = await readFile(modelPath);
const actualModelHash = sha256(modelBytes);
if (actualModelHash !== variant.sha256) {
  throw new Error(
    `ONNX asset hash mismatch: expected ${variant.sha256}, received ${actualModelHash}.`,
  );
}

const rssBeforeLoad = process.memoryUsage().rss;
const loadStartedAt = performance.now();
const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
const loadDurationMs = performance.now() - loadStartedAt;
const rssAfterLoad = process.memoryUsage().rss;
const tokenizer = await AutoTokenizer.from_pretrained(MODEL.id, {
  revision: MODEL.revision,
});

const cases = [];
let peakRssBytes = rssAfterLoad;
if (observedDirectory) await mkdir(resolve(observedDirectory), { recursive: true });
for (const fixture of manifest.cases) {
  const tokenized = await tokenizer(fixture.prompt);
  const tokenIds = Array.from(tokenized.input_ids.data, Number);
  const tokens = tokenIds.map((tokenId, position) => {
    const text = tokenizer.decode([tokenId], { skip_special_tokens: false });
    return {
      byteValues: [...new TextEncoder().encode(text)],
      position,
      text,
      tokenId,
    };
  });
  const tokenizerExact =
    JSON.stringify(tokenIds) === JSON.stringify(fixture.tokenIds) &&
    JSON.stringify(tokens) === JSON.stringify(fixture.tokens);

  const observedRun = await runModel(session, tokenIds);
  const mutatedIds = [...tokenIds];
  mutatedIds[mutatedIds.length - 1] = fixture.causalMaskCheck.mutatedFinalTokenId;
  const mutatedRun = await runModel(session, mutatedIds);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);

  const goldenBuffer = await readFile(resolve(fixtureDirectory, fixture.logits.path));
  if (sha256(goldenBuffer) !== fixture.logits.sha256) {
    throw new Error(`Golden fixture hash mismatch for ${fixture.id}.`);
  }
  const observed = finalLogits(observedRun.logits);
  const observedBuffer = Buffer.from(observed.buffer, observed.byteOffset, observed.byteLength);
  const observedPath = observedDirectory
    ? resolve(observedDirectory, `${fixture.id}.logits.f32le`)
    : null;
  if (observedPath) await writeFile(observedPath, observedBuffer);
  const result = {
    causalMask: compareCausalPrefix(observedRun.logits, mutatedRun.logits),
    fixtureId: fixture.id,
    inferenceDurationMs: observedRun.durationMs,
    metrics: compareLogits(float32FromBuffer(goldenBuffer), observed),
    observedLogits: {
      encoding: 'float32-le',
      path: observedPath ? relative(repositoryRoot, observedPath) : null,
      sha256: sha256(observedBuffer),
      valueCount: observed.length,
    },
    prompt: fixture.prompt,
    tokenizer: {
      exact: tokenizerExact,
      observedTokenIds: tokenIds,
    },
  };
  cases.push({ ...result, acceptance: evaluateCase(result, tolerance.requirements) });
}

const warmRun = await runModel(session, manifest.cases[0].tokenIds);
peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
await session.release();

const report = {
  accepted: cases.every((item) => item.acceptance.passed),
  backend: {
    executionProvider: 'wasm',
    model: {
      assetPath: variant.assetPath,
      id: MODEL.id,
      revision: MODEL.revision,
      sha256: variant.sha256,
      variant: variantName,
    },
    onnxRuntimeWeb: '1.22.0-dev.20250409-89f8206ba4',
    transformersJs: '3.8.1',
  },
  cases,
  environment: {
    architecture: arch(),
    node: process.version,
    operatingSystem: `${platform()} ${release()}`,
  },
  performance: {
    loadDurationMs,
    peakRssBytes,
    rssAfterLoadBytes: rssAfterLoad,
    rssBeforeLoadBytes: rssBeforeLoad,
    warmHeroInferenceDurationMs: warmRun.durationMs,
  },
  reportFormatVersion: '1.0.0',
  toleranceProfile: tolerance,
};

if (process.argv.includes('--write-report')) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

for (const item of cases) {
  console.log(
    `${item.fixtureId}: ${item.acceptance.passed ? 'PASS' : 'FAIL'} · ` +
      `top50 ${item.metrics.ranking.top50Overlap}/50 · ` +
      `mean |Δ| ${item.metrics.logitError.meanAbsolute.toFixed(4)} · ` +
      `centred ${item.metrics.logitError.meanCentredAbsolute.toFixed(4)}`,
  );
}
console.log(
  `WASM load ${loadDurationMs.toFixed(1)} ms · warm hero ${warmRun.durationMs.toFixed(1)} ms · ` +
    `peak RSS ${(peakRssBytes / 1024 / 1024).toFixed(1)} MiB`,
);

if (expectRejection && report.accepted) {
  throw new Error(`${variantName} unexpectedly passed the rejection gate.`);
}

if (!report.accepted && !expectRejection) {
  const failures = cases.flatMap((item) =>
    item.acceptance.failures.map((failure) => `${item.fixtureId}: ${failure}`),
  );
  throw new Error(`Golden verification failed:\n${failures.join('\n')}`);
}

if (expectRejection) {
  console.log(`${variantName} rejection reproduced as expected.`);
}
