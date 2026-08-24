import type {
  AssetCacheStatus,
  ModelIdentity,
  ModelLoadReport,
  PredictionCapture,
  RawCandidate,
  RuntimeCapabilities,
  TokenSpecimen,
  TokenizerIdentity,
} from '@observatory/domain';

export const DISTILGPT2_MODEL = {
  id: 'Xenova/distilgpt2',
  revision: 'a41c10485c18a64b6606729b6a082330cbd8f49e',
} as const;

export const DISTILGPT2_RUNTIME =
  '@huggingface/transformers@3.8.1; onnxruntime-web@1.22.0-dev.20250409-89f8206ba4' as const;

export const DISTILGPT2_ASSETS = {
  tokenizerBundle: {
    sha256: 'fb803549cd431422aa2398fd669a1b2cff3ac8c57ff5843d9a65869a4df0b592',
  },
  wasmFp32: {
    path: 'onnx/model.onnx',
    sha256: 'd605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c',
    sizeBytes: 327_825_716,
  },
  wasmInt8Rejected: {
    path: 'onnx/model_int8.onnx',
    sha256: '80b02da4fe266412bc49c9955a518151c50f9bac062f596a875068492a21f080',
    sizeBytes: 236_698_606,
  },
  webGpuFp16: {
    path: 'onnx/model_fp16.onnx',
    sha256: '0f1853d55a420459d178be4c1804577ec0e4b992568c3991ebdf292b1f4319c0',
    sizeBytes: 164_003_836,
  },
} as const;

export const DISTILGPT2_VERIFICATION = {
  wasmFp32: {
    profileId: 'distilgpt2-wasm-fp32-v1',
    referenceModel: 'distilbert/distilgpt2@2290a62682d06624634c1f46a6ad5be0f47f38aa',
    report: 'model-tools/verification/wasm-fp32-report.json',
    status: 'accepted',
  },
  wasmInt8: {
    profileId: 'distilgpt2-wasm-int8-v1',
    reason: 'Top-1 and causal-prefix checks failed the pinned four-prompt suite.',
    report: 'model-tools/verification/wasm-int8-report.json',
    status: 'rejected',
  },
} as const;

export type LiveBackend = 'wasm' | 'webgpu';

export interface LoadProgress {
  readonly loadedBytes: number | null;
  readonly message: string;
  readonly progress: number;
  readonly totalBytes: number | null;
}

export type InferenceWorkerRequest =
  | {
      readonly backend: LiveBackend;
      readonly id: string;
      readonly type: 'load';
    }
  | {
      readonly id: string;
      readonly prompt: string;
      readonly topN: number;
      readonly type: 'predict';
    }
  | { readonly id: string; readonly type: 'dispose' };

export type InferenceWorkerResponse =
  | { readonly id: string; readonly progress: LoadProgress; readonly type: 'progress' }
  | {
      readonly id: string;
      readonly load: ModelLoadReport;
      readonly model: ModelIdentity;
      readonly type: 'ready';
    }
  | { readonly capture: PredictionCapture; readonly id: string; readonly type: 'prediction' }
  | { readonly id: string; readonly type: 'disposed' }
  | { readonly id: string; readonly message: string; readonly type: 'error' };

interface CapabilityScope {
  readonly Worker?: unknown;
  readonly indexedDB?: unknown;
  readonly isSecureContext?: boolean;
  readonly navigator?: { readonly gpu?: unknown };
}

export function detectRuntimeCapabilities(
  scope: CapabilityScope = globalThis,
): RuntimeCapabilities {
  return {
    indexedDb: 'indexedDB' in scope && scope.indexedDB !== undefined,
    secureContext: scope.isSecureContext === true,
    webGpu: scope.navigator?.gpu !== undefined,
    webWorker: 'Worker' in scope && scope.Worker !== undefined,
  };
}

interface TensorLike {
  readonly data: ArrayLike<bigint | number>;
  readonly dims: readonly number[];
}

type TokenizerInputs = Record<string, TensorLike>;

interface RuntimeTokenizer {
  (text: string): Promise<TokenizerInputs>;
  decode(tokenIds: number[], options?: { skip_special_tokens?: boolean }): string;
}

interface RuntimeModel {
  (inputs: TokenizerInputs): Promise<{ readonly logits: TensorLike }>;
  dispose(): Promise<unknown[]>;
}

interface ProgressInfo {
  readonly file?: string;
  readonly loaded?: number;
  readonly progress?: number;
  readonly status: string;
  readonly total?: number;
}

function toLoadProgress(info: ProgressInfo): LoadProgress {
  const progress = info.progress === undefined ? 0 : Math.max(0, Math.min(100, info.progress));
  return {
    loadedBytes: info.loaded ?? null,
    message:
      info.status === 'progress' || info.status === 'progress_total'
        ? `Loading ${info.file ?? 'model assets'}`
        : info.status === 'done'
          ? `Cached ${info.file ?? 'model asset'}`
          : 'Preparing local model',
    progress,
    totalBytes: info.total ?? null,
  };
}

export function extractFinalLogits(logits: TensorLike): Float32Array {
  const vocabularySize = logits.dims.at(-1);
  const sequenceLength = logits.dims.at(-2);
  if (!vocabularySize || !sequenceLength || logits.dims.length < 2) {
    throw new Error(`Unexpected logits shape: [${logits.dims.join(', ')}].`);
  }

  const offset = (sequenceLength - 1) * vocabularySize;
  return Float32Array.from(
    Array.from({ length: vocabularySize }, (_, tokenId) => Number(logits.data[offset + tokenId])),
  );
}

export function rankTopCandidates(logits: Float32Array, topN: number): readonly RawCandidate[] {
  const leaders: { logit: number; tokenId: number }[] = [];
  for (let tokenId = 0; tokenId < logits.length; tokenId += 1) {
    const value = logits[tokenId] as number;
    if (!Number.isFinite(value)) continue;

    const insertionIndex = leaders.findIndex((candidate) => value > candidate.logit);
    if (insertionIndex === -1) {
      if (leaders.length < topN) leaders.push({ logit: value, tokenId });
    } else {
      leaders.splice(insertionIndex, 0, { logit: value, tokenId });
      if (leaders.length > topN) leaders.pop();
    }
  }
  return leaders.map(({ logit, tokenId }) => ({ logit, text: '', tokenId }));
}

async function sha256Float32(values: Float32Array): Promise<string> {
  const bytes = Uint8Array.from(
    new Uint8Array(values.buffer, values.byteOffset, values.byteLength),
  );
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function tokenIdsFrom(inputs: TokenizerInputs): number[] {
  const inputIds = inputs.input_ids;
  if (!inputIds) throw new Error('Tokenizer did not return input_ids.');
  return Array.from(inputIds.data, Number);
}

function tokenSpecimens(tokenizer: RuntimeTokenizer, tokenIds: readonly number[]): TokenSpecimen[] {
  const encoder = new TextEncoder();
  return tokenIds.map((tokenId, position) => {
    const text = tokenizer.decode([tokenId], { skip_special_tokens: false });
    return {
      byteValues: [...encoder.encode(text)],
      position,
      text,
      tokenId,
    };
  });
}

/** Pinned local adapter with verified fp32 WASM and isolated experimental WebGPU paths. */
export class TransformersDistilGpt2Adapter {
  readonly #backend: LiveBackend;
  #model: RuntimeModel | null = null;
  #tokenizer: RuntimeTokenizer | null = null;

  public constructor(backend: LiveBackend) {
    this.#backend = backend;
  }

  public get modelIdentity(): ModelIdentity {
    const asset =
      this.#backend === 'webgpu' ? DISTILGPT2_ASSETS.webGpuFp16 : DISTILGPT2_ASSETS.wasmFp32;
    return {
      assetHash: `sha256:${asset.sha256}`,
      dtype: this.#backend === 'webgpu' ? 'fp16' : 'fp32',
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
      runtime: DISTILGPT2_RUNTIME,
      verificationStatus: this.#backend === 'webgpu' ? 'unverified' : 'verified',
    };
  }

  public get tokenizerIdentity(): TokenizerIdentity {
    return {
      assetHash: `sha256:${DISTILGPT2_ASSETS.tokenizerBundle.sha256}`,
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
    };
  }

  async #cacheStatus(): Promise<AssetCacheStatus> {
    if (!('caches' in globalThis)) return 'unavailable';
    const asset =
      this.#backend === 'webgpu' ? DISTILGPT2_ASSETS.webGpuFp16 : DISTILGPT2_ASSETS.wasmFp32;
    const url = `https://huggingface.co/${DISTILGPT2_MODEL.id}/resolve/${DISTILGPT2_MODEL.revision}/${asset.path}`;
    try {
      return (await globalThis.caches.match(url)) ? 'warm-cache' : 'cold-download';
    } catch {
      return 'unavailable';
    }
  }

  public async load(
    onProgress: (progress: LoadProgress) => void = () => undefined,
  ): Promise<ModelLoadReport> {
    const { AutoModelForCausalLM, AutoTokenizer } = await import('@huggingface/transformers');
    const progressCallback = (info: ProgressInfo) => onProgress(toLoadProgress(info));
    const device = this.#backend === 'webgpu' ? 'webgpu' : 'wasm';
    const dtype = this.#backend === 'webgpu' ? 'fp16' : 'fp32';
    const cacheStatus = await this.#cacheStatus();
    const startedAt = performance.now();

    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(DISTILGPT2_MODEL.id, {
        progress_callback: progressCallback,
        revision: DISTILGPT2_MODEL.revision,
      }),
      AutoModelForCausalLM.from_pretrained(DISTILGPT2_MODEL.id, {
        device,
        dtype,
        progress_callback: progressCallback,
        revision: DISTILGPT2_MODEL.revision,
      }),
    ]);
    this.#tokenizer = tokenizer;
    this.#model = model as RuntimeModel;
    return {
      cacheStatus,
      durationMs: performance.now() - startedAt,
      modelAssetBytes:
        this.#backend === 'webgpu'
          ? DISTILGPT2_ASSETS.webGpuFp16.sizeBytes
          : DISTILGPT2_ASSETS.wasmFp32.sizeBytes,
    };
  }

  public async predict(prompt: string, topN = 50): Promise<PredictionCapture> {
    if (!this.#model || !this.#tokenizer) throw new Error('Load the model before predicting.');
    if (prompt.trim().length === 0) throw new Error('Prompt must not be empty.');
    if (!Number.isInteger(topN) || topN < 1 || topN > 200) {
      throw new Error('topN must be an integer from 1 to 200.');
    }

    const startedAt = performance.now();
    const inputs = await this.#tokenizer(prompt);
    const output = await this.#model(inputs);
    const logits = extractFinalLogits(output.logits);
    const candidates = rankTopCandidates(logits, topN).map((candidate) => ({
      ...candidate,
      text: this.#tokenizer?.decode([candidate.tokenId], { skip_special_tokens: false }) ?? '',
    }));
    const verificationProfileId =
      this.#backend === 'wasm' ? DISTILGPT2_VERIFICATION.wasmFp32.profileId : null;

    return {
      candidateUniverse: {
        captured: logits.length,
        complete: true,
        label: `Complete ${logits.length.toLocaleString()}-logit model vocabulary`,
        size: logits.length,
      },
      candidates,
      durationMs: performance.now() - startedAt,
      logits,
      logitsSha256: await sha256Float32(logits),
      mode: this.#backend === 'webgpu' ? 'live-webgpu' : 'live-wasm',
      model: this.modelIdentity,
      promptTokens: tokenSpecimens(this.#tokenizer, tokenIdsFrom(inputs)),
      tokenizer: this.tokenizerIdentity,
      verificationProfileId,
    };
  }

  public async dispose(): Promise<void> {
    await this.#model?.dispose();
    this.#model = null;
    this.#tokenizer = null;
  }
}

export function createInferenceWorkerHandler(
  postResponse: (response: InferenceWorkerResponse, transfer?: readonly Transferable[]) => void,
): (request: InferenceWorkerRequest) => Promise<void> {
  let adapter: TransformersDistilGpt2Adapter | null = null;

  return async (request) => {
    try {
      if (request.type === 'load') {
        await adapter?.dispose();
        adapter = new TransformersDistilGpt2Adapter(request.backend);
        const load = await adapter.load((progress) =>
          postResponse({ id: request.id, progress, type: 'progress' }),
        );
        postResponse({ id: request.id, load, model: adapter.modelIdentity, type: 'ready' });
        return;
      }
      if (request.type === 'predict') {
        if (!adapter) throw new Error('Load the model before predicting.');
        const capture = await adapter.predict(request.prompt, request.topN);
        postResponse({ capture, id: request.id, type: 'prediction' }, [
          capture.logits.buffer as ArrayBuffer,
        ]);
        return;
      }
      await adapter?.dispose();
      adapter = null;
      postResponse({ id: request.id, type: 'disposed' });
    } catch (error) {
      postResponse({
        id: request.id,
        message: error instanceof Error ? error.message : 'Unknown inference worker error.',
        type: 'error',
      });
    }
  };
}
