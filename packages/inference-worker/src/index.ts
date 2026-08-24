import type {
  AssetCacheStatus,
  InstrumentCapability,
  ModelIdentity,
  ModelLoadReport,
  PredictionCapture,
  RawCandidate,
  RuntimeCapabilities,
  TokenSpecimen,
  TokenizerIdentity,
} from '@observatory/domain';

import type { GenerationRequestContext } from './generation-controller.ts';

export * from './generation-controller.ts';

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

export const TOKEN_SPECIMEN_PROFILE_ID = 'distilgpt2-tokenizer-specimens-v1' as const;
export const TOKEN_SPECIMEN_METHOD_VERSION = 'decoded-fragment-utf8-v1' as const;

const NO_CAPTURE = Object.freeze({ maxCapturedBytes: 0 });

/**
 * Declares only outputs available from the active worker session. The accepted
 * fp32 graph currently exposes final logits, not intermediate tensors.
 */
export function instrumentCapabilitiesForModel(
  model: ModelIdentity,
): readonly InstrumentCapability[] {
  const pinnedTokenizer =
    model.id === DISTILGPT2_MODEL.id && model.revision === DISTILGPT2_MODEL.revision;
  return Object.freeze([
    {
      evidenceClass: 'measured',
      id: 'token-specimens',
      limits: Object.freeze({ maxFragmentBytes: 256, maxTokens: 128 }),
      methodVersion: TOKEN_SPECIMEN_METHOD_VERSION,
      profileId: pinnedTokenizer ? TOKEN_SPECIMEN_PROFILE_ID : null,
      reason: pinnedTokenizer
        ? 'Exact token IDs and decoded fragments come from the pinned tokenizer; displayed UTF-8 bytes are derived from each fragment.'
        : 'The active tokenizer does not match the accepted token-specimen profile.',
      status: pinnedTokenizer ? 'verified' : 'unverified',
    },
    {
      evidenceClass: 'measured',
      id: 'hidden-states',
      limits: NO_CAPTURE,
      methodVersion: 'not-admitted',
      profileId: null,
      reason:
        'The active ONNX graph exposes final logits only; no hidden-state output has passed a golden profile.',
      status: 'unavailable',
    },
    {
      evidenceClass: 'measured',
      id: 'attention',
      limits: NO_CAPTURE,
      methodVersion: 'not-admitted',
      profileId: null,
      reason:
        'No attention tensor with verified axes, causal mask and row normalisation is exposed by the active graph.',
      status: 'unavailable',
    },
    {
      evidenceClass: 'probed',
      id: 'logit-lens',
      limits: NO_CAPTURE,
      methodVersion: 'deferred',
      profileId: null,
      reason: 'No named layer-normalisation and unembedding probe has been selected or verified.',
      status: 'unavailable',
    },
    {
      evidenceClass: 'projected',
      id: 'semantic-projection',
      limits: NO_CAPTURE,
      methodVersion: 'deferred',
      profileId: null,
      reason:
        'No verified vector source, distance metric or deterministic projection profile is available.',
      status: 'unavailable',
    },
  ]);
}

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
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly type: 'load';
    }
  | {
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly inputTokenIds?: readonly number[];
      readonly prompt: string;
      readonly topN: number;
      readonly type: 'predict';
    }
  | {
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly type: 'dispose';
    };

export type InferenceWorkerResponse =
  | {
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly progress: LoadProgress;
      readonly type: 'progress';
    }
  | {
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly instrumentCapabilities: readonly InstrumentCapability[];
      readonly load: ModelLoadReport;
      readonly model: ModelIdentity;
      readonly type: 'ready';
    }
  | {
      readonly capture: PredictionCapture;
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly type: 'prediction';
    }
  | {
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly type: 'disposed';
    }
  | {
      readonly context: GenerationRequestContext;
      readonly id: string;
      readonly message: string;
      readonly type: 'error';
    };

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
  dispose?(): void;
}

interface TensorConstructor {
  new (type: 'int64', data: BigInt64Array, dims: number[]): TensorLike;
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
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
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
  #tensorConstructor: TensorConstructor | null = null;
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

  public get instrumentCapabilities(): readonly InstrumentCapability[] {
    return instrumentCapabilitiesForModel(this.modelIdentity);
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
    const { AutoModelForCausalLM, AutoTokenizer, Tensor } =
      await import('@huggingface/transformers');
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
    this.#tensorConstructor = Tensor;
    return {
      cacheStatus,
      durationMs: performance.now() - startedAt,
      modelAssetBytes:
        this.#backend === 'webgpu'
          ? DISTILGPT2_ASSETS.webGpuFp16.sizeBytes
          : DISTILGPT2_ASSETS.wasmFp32.sizeBytes,
    };
  }

  public async predict(
    prompt: string,
    topN = 50,
    inputTokenIds?: readonly number[],
  ): Promise<PredictionCapture> {
    if (!this.#model || !this.#tokenizer) throw new Error('Load the model before predicting.');
    if (prompt.trim().length === 0) throw new Error('Prompt must not be empty.');
    if (!Number.isInteger(topN) || topN < 1 || topN > 200) {
      throw new Error('topN must be an integer from 1 to 200.');
    }

    const startedAt = performance.now();
    let inputs: TokenizerInputs;
    if (inputTokenIds) {
      if (!this.#tensorConstructor) throw new Error('Runtime tensor constructor is unavailable.');
      if (
        inputTokenIds.length === 0 ||
        inputTokenIds.some(
          (tokenId) => !Number.isInteger(tokenId) || tokenId < 0 || tokenId >= 50_257,
        )
      ) {
        throw new Error('inputTokenIds must contain valid DistilGPT2 vocabulary IDs.');
      }
      const dims = [1, inputTokenIds.length];
      inputs = {
        attention_mask: new this.#tensorConstructor(
          'int64',
          new BigInt64Array(inputTokenIds.length).fill(1n),
          dims,
        ),
        input_ids: new this.#tensorConstructor(
          'int64',
          BigInt64Array.from(inputTokenIds, BigInt),
          dims,
        ),
      };
    } else {
      inputs = await this.#tokenizer(prompt);
    }
    const exactInputTokenIds = inputTokenIds ? [...inputTokenIds] : tokenIdsFrom(inputs);
    let output: { readonly logits: TensorLike };
    try {
      output = await this.#model(inputs);
    } finally {
      for (const tensor of Object.values(inputs)) tensor.dispose?.();
    }
    let logits: Float32Array;
    try {
      logits = extractFinalLogits(output.logits);
    } finally {
      output.logits.dispose?.();
    }
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
      promptTokens: tokenSpecimens(this.#tokenizer, exactInputTokenIds),
      tokenizer: this.tokenizerIdentity,
      verificationProfileId,
    };
  }

  public async dispose(): Promise<void> {
    await this.#model?.dispose();
    this.#model = null;
    this.#tensorConstructor = null;
    this.#tokenizer = null;
  }
}

export interface InferenceAdapter {
  readonly instrumentCapabilities: readonly InstrumentCapability[];
  readonly modelIdentity: ModelIdentity;
  dispose(): Promise<void>;
  load(onProgress?: (progress: LoadProgress) => void): Promise<ModelLoadReport>;
  predict(
    prompt: string,
    topN?: number,
    inputTokenIds?: readonly number[],
  ): Promise<PredictionCapture>;
}

export function createInferenceWorkerHandler(
  postResponse: (response: InferenceWorkerResponse, transfer?: readonly Transferable[]) => void,
  createAdapter: (backend: LiveBackend) => InferenceAdapter = (backend) =>
    new TransformersDistilGpt2Adapter(backend),
): (request: InferenceWorkerRequest) => Promise<void> {
  let adapter: InferenceAdapter | null = null;

  return async (request) => {
    try {
      if (request.type === 'load') {
        await adapter?.dispose();
        const loadingAdapter = createAdapter(request.backend);
        adapter = loadingAdapter;
        const load = await loadingAdapter.load((progress) =>
          postResponse({ context: request.context, id: request.id, progress, type: 'progress' }),
        );
        if (adapter !== loadingAdapter) {
          await loadingAdapter.dispose();
          return;
        }
        postResponse({
          context: request.context,
          id: request.id,
          instrumentCapabilities: loadingAdapter.instrumentCapabilities,
          load,
          model: loadingAdapter.modelIdentity,
          type: 'ready',
        });
        return;
      }
      if (request.type === 'predict') {
        if (!adapter) throw new Error('Load the model before predicting.');
        const predictingAdapter = adapter;
        const capture = await predictingAdapter.predict(
          request.prompt,
          request.topN,
          request.inputTokenIds,
        );
        postResponse({ capture, context: request.context, id: request.id, type: 'prediction' }, [
          capture.logits.buffer as ArrayBuffer,
        ]);
        return;
      }
      await adapter?.dispose();
      adapter = null;
      postResponse({ context: request.context, id: request.id, type: 'disposed' });
    } catch (error) {
      postResponse({
        context: request.context,
        id: request.id,
        message: error instanceof Error ? error.message : 'Unknown inference worker error.',
        type: 'error',
      });
    }
  };
}
