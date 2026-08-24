import type {
  ModelIdentity,
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
  | { readonly id: string; readonly model: ModelIdentity; readonly type: 'ready' }
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

function topCandidates(logits: TensorLike, topN: number): readonly RawCandidate[] {
  const vocabularySize = logits.dims.at(-1);
  const sequenceLength = logits.dims.at(-2);
  if (!vocabularySize || !sequenceLength || logits.dims.length < 2) {
    throw new Error(`Unexpected logits shape: [${logits.dims.join(', ')}].`);
  }

  const offset = (sequenceLength - 1) * vocabularySize;
  const leaders: { logit: number; tokenId: number }[] = [];
  for (let tokenId = 0; tokenId < vocabularySize; tokenId += 1) {
    const value = Number(logits.data[offset + tokenId]);
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

/**
 * Experimental live adapter. It returns genuine top-N runtime logits but marks
 * the capture incomplete and unverified, so it cannot yet drive exact full-vocabulary sampling.
 */
export class TransformersDistilGpt2Adapter {
  readonly #backend: LiveBackend;
  #model: RuntimeModel | null = null;
  #tokenizer: RuntimeTokenizer | null = null;

  public constructor(backend: LiveBackend) {
    this.#backend = backend;
  }

  public get modelIdentity(): ModelIdentity {
    return {
      assetHash: null,
      dtype: this.#backend === 'webgpu' ? 'fp16' : 'int8',
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
      runtime: '@huggingface/transformers@3.8.1',
      verificationStatus: 'unverified',
    };
  }

  public get tokenizerIdentity(): TokenizerIdentity {
    return {
      assetHash: null,
      id: DISTILGPT2_MODEL.id,
      revision: DISTILGPT2_MODEL.revision,
    };
  }

  public async load(onProgress: (progress: LoadProgress) => void = () => undefined): Promise<void> {
    const { AutoModelForCausalLM, AutoTokenizer } = await import('@huggingface/transformers');
    const progressCallback = (info: ProgressInfo) => onProgress(toLoadProgress(info));
    const device = this.#backend === 'webgpu' ? 'webgpu' : 'wasm';
    const dtype = this.#backend === 'webgpu' ? 'fp16' : 'int8';

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
    const candidates = topCandidates(output.logits, topN).map((candidate) => ({
      ...candidate,
      text: this.#tokenizer?.decode([candidate.tokenId], { skip_special_tokens: false }) ?? '',
    }));
    const vocabularySize = output.logits.dims.at(-1) as number;

    return {
      candidateUniverse: {
        captured: candidates.length,
        complete: false,
        label: `Top ${candidates.length} of ${vocabularySize.toLocaleString()} model logits`,
        size: vocabularySize,
      },
      candidates,
      durationMs: performance.now() - startedAt,
      mode: this.#backend === 'webgpu' ? 'live-webgpu' : 'live-wasm',
      model: this.modelIdentity,
      promptTokens: tokenSpecimens(this.#tokenizer, tokenIdsFrom(inputs)),
      tokenizer: this.tokenizerIdentity,
    };
  }

  public async dispose(): Promise<void> {
    await this.#model?.dispose();
    this.#model = null;
    this.#tokenizer = null;
  }
}

export function createInferenceWorkerHandler(
  postResponse: (response: InferenceWorkerResponse) => void,
): (request: InferenceWorkerRequest) => Promise<void> {
  let adapter: TransformersDistilGpt2Adapter | null = null;

  return async (request) => {
    try {
      if (request.type === 'load') {
        await adapter?.dispose();
        adapter = new TransformersDistilGpt2Adapter(request.backend);
        await adapter.load((progress) =>
          postResponse({ id: request.id, progress, type: 'progress' }),
        );
        postResponse({ id: request.id, model: adapter.modelIdentity, type: 'ready' });
        return;
      }
      if (request.type === 'predict') {
        if (!adapter) throw new Error('Load the model before predicting.');
        const capture = await adapter.predict(request.prompt, request.topN);
        postResponse({ capture, id: request.id, type: 'prediction' });
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
