import { afterEach, describe, expect, it } from 'vitest';

import type {
  CandidateUniverse,
  InferenceProvenance,
  ModelIdentity,
  RawCandidate,
  SamplerConfig,
  TokenizerIdentity,
} from '@observatory/domain';

import {
  appendCompactGenerationStep,
  createCompactGenerationStep,
  createCompactTraceBundle,
  forkCompactTrace,
  IndexedDbTraceNotebook,
  MemoryTraceNotebook,
  NotebookError,
  NotebookQuotaError,
  resampleCompactGenerationStep,
  resolveCompactTraceHistory,
} from './index';

interface FakeRequest<T> extends EventTarget {
  error: DOMException | null;
  result: T;
}

function completeRequest<T>(result: T): IDBRequest<T> {
  const request = new EventTarget() as FakeRequest<T>;
  request.error = null;
  request.result = result;
  queueMicrotask(() => request.dispatchEvent(new Event('success')));
  return request as unknown as IDBRequest<T>;
}

class FakeObjectStore {
  readonly #records: Map<IDBValidKey, unknown>;
  readonly #keyPath: string;

  public constructor(records: Map<IDBValidKey, unknown>, keyPath: string) {
    this.#records = records;
    this.#keyPath = keyPath;
  }

  public clear(): IDBRequest<undefined> {
    this.#records.clear();
    return completeRequest(undefined);
  }

  public getAll(): IDBRequest<unknown[]> {
    return completeRequest([...this.#records.values()]);
  }

  public put(value: Record<string, unknown>): IDBRequest<IDBValidKey> {
    const key = value[this.#keyPath];
    if (typeof key !== 'string') throw new Error(`Missing ${this.#keyPath} key.`);
    this.#records.set(key, value);
    return completeRequest(key);
  }
}

class FakeTransaction extends EventTarget {
  public error: DOMException | null = null;
  readonly #stores: Map<string, Map<IDBValidKey, unknown>>;

  public constructor(stores: Map<string, Map<IDBValidKey, unknown>>) {
    super();
    this.#stores = stores;
    setTimeout(() => this.dispatchEvent(new Event('complete')), 0);
  }

  public objectStore(name: string): IDBObjectStore {
    const records = this.#stores.get(name);
    if (!records) throw new Error(`Unknown store ${name}.`);
    const keyPath = name === 'payloads' ? 'sha256' : 'traceId';
    return new FakeObjectStore(records, keyPath) as unknown as IDBObjectStore;
  }
}

class FakeDatabase {
  readonly #stores = new Map<string, Map<IDBValidKey, unknown>>();
  public closed = false;
  public readonly objectStoreNames = {
    contains: (name: string) => this.#stores.has(name),
  };

  public close(): void {
    this.closed = true;
  }

  public createObjectStore(name: string): IDBObjectStore {
    const records = new Map<IDBValidKey, unknown>();
    this.#stores.set(name, records);
    return new FakeObjectStore(
      records,
      name === 'payloads' ? 'sha256' : 'traceId',
    ) as unknown as IDBObjectStore;
  }

  public transaction(): IDBTransaction {
    return new FakeTransaction(this.#stores) as unknown as IDBTransaction;
  }
}

class FakeIndexedDbFactory {
  public readonly database = new FakeDatabase();

  public open(): IDBOpenDBRequest {
    const request = new EventTarget() as FakeRequest<IDBDatabase>;
    request.error = null;
    request.result = this.database as unknown as IDBDatabase;
    queueMicrotask(() => {
      request.dispatchEvent(new Event('upgradeneeded'));
      request.dispatchEvent(new Event('success'));
    });
    return request as unknown as IDBOpenDBRequest;
  }
}

const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

afterEach(() => {
  if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
  else Reflect.deleteProperty(globalThis, 'indexedDB');
});

const model: ModelIdentity = {
  assetHash: null,
  dtype: 'fixture',
  id: 'notebook-fixture',
  revision: '1',
  runtime: 'vitest',
  verificationStatus: 'illustrative',
};
const tokenizer: TokenizerIdentity = {
  assetHash: null,
  id: 'notebook-tokenizer',
  revision: '1',
};
const config: SamplerConfig = {
  mode: 'greedy',
  seed: 'notebook-seed',
  temperature: 1,
  topK: null,
  topP: 1,
};
const universe: CandidateUniverse = {
  captured: 2,
  complete: true,
  label: 'Complete notebook fixture',
  size: 2,
};
const inference: InferenceProvenance = {
  durationMs: null,
  evidenceClass: 'derived',
  logitsSha256: null,
  mode: 'illustrative-demo',
  note: 'Notebook fixture.',
  verificationProfileId: null,
  verificationStatus: 'illustrative',
};
const candidates: readonly RawCandidate[] = [
  { logit: 2, text: ' one', tokenId: 0 },
  { logit: 1, text: ' two', tokenId: 1 },
];

async function baselineBundle(traceId = 'notebook-baseline', title = 'Notebook baseline') {
  const empty = createCompactTraceBundle({
    createdAt: '2026-08-24T00:00:00.000Z',
    mode: 'illustrative-demo',
    model,
    prompt: 'Notebook',
    promptTokens: [{ byteValues: [78], position: 0, text: 'Notebook', tokenId: 10 }],
    rootSeed: config.seed,
    title,
    tokenizer,
    traceId,
  });
  const step = await createCompactGenerationStep({
    candidateUniverse: universe,
    config,
    createdOrder: 0,
    inference,
    inputTokenIds: [10],
    rawCandidates: candidates,
  });
  return appendCompactGenerationStep(empty, traceId, step);
}

describe('local trace notebook', () => {
  it('reports that IndexedDB is unavailable instead of silently losing persistence', async () => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
    await expect(IndexedDbTraceNotebook.open('missing-indexed-db')).rejects.toThrow(
      'IndexedDB is unavailable',
    );
  });

  it('persists, lists, exports and deletes through the IndexedDB transaction adapter', async () => {
    const factory = new FakeIndexedDbFactory();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: factory,
    });
    const notebook = await IndexedDbTraceNotebook.open('indexed-db-contract');
    const baseline = await baselineBundle();

    await notebook.saveBundle(baseline);
    expect(await notebook.listTraces()).toMatchObject([
      { stepCount: 1, title: 'Notebook baseline', traceId: 'notebook-baseline' },
    ]);
    expect(await notebook.report()).toMatchObject({
      payloadCount: 1,
      payloadReferences: 1,
      traceCount: 1,
    });
    expect((await notebook.exportBundle('notebook-baseline')).rootTraceId).toBe(
      'notebook-baseline',
    );

    await notebook.deleteTrace('notebook-baseline');
    expect((await notebook.report()).traceCount).toBe(0);
    notebook.close();
    expect(factory.database.closed).toBe(true);
  });

  it('serialises concurrent IndexedDB writes without losing either trace', async () => {
    const factory = new FakeIndexedDbFactory();
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: factory,
    });
    const notebook = await IndexedDbTraceNotebook.open('indexed-db-concurrency');
    const first = await baselineBundle();
    const second = await baselineBundle('notebook-second', 'Notebook second');

    await Promise.all([notebook.saveBundle(first), notebook.saveBundle(second)]);

    expect((await notebook.listTraces()).map((trace) => trace.traceId).sort()).toEqual([
      'notebook-baseline',
      'notebook-second',
    ]);
    expect(await notebook.report()).toMatchObject({
      payloadCount: 1,
      payloadReferences: 2,
      traceCount: 2,
    });
    notebook.close();
  });

  it('persists ancestry and deduplicated payload references', async () => {
    const notebook = new MemoryTraceNotebook();
    const baseline = await baselineBundle();
    notebook.saveBundle(baseline, '2026-08-24T00:00:01.000Z');

    let child = forkCompactTrace(baseline, 'notebook-baseline', {
      createdAt: '2026-08-24T00:01:00.000Z',
      forkStep: 0,
      title: 'Notebook child',
      traceId: 'notebook-child',
    });
    const source = resolveCompactTraceHistory(child, 'notebook-baseline')[0];
    if (!source) throw new Error('Expected a source step.');
    child = appendCompactGenerationStep(
      child,
      'notebook-child',
      await resampleCompactGenerationStep(child, source, {
        createdOrder: 0,
        interventions: { forcedTokenId: 1, suppressedTokenIds: [] },
        prngStateBefore: source.sampler.prngStateBefore,
      }),
    );
    notebook.saveBundle(child, '2026-08-24T00:01:01.000Z');

    expect(notebook.report()).toMatchObject({
      payloadCount: 1,
      payloadReferences: 2,
      traceCount: 2,
    });
    const exported = notebook.exportBundle('notebook-child', '2026-08-24T00:02:00.000Z');
    expect(exported.traces.map((trace) => trace.traceId)).toEqual([
      'notebook-baseline',
      'notebook-child',
    ]);
  });

  it('prevents parent deletion until descendants are removed', async () => {
    const notebook = new MemoryTraceNotebook();
    const baseline = await baselineBundle();
    notebook.saveBundle(baseline);
    const child = forkCompactTrace(baseline, 'notebook-baseline', {
      forkStep: 1,
      title: 'Child',
      traceId: 'notebook-child',
    });
    notebook.saveBundle(child);

    expect(() => notebook.deleteTrace('notebook-baseline')).toThrow(NotebookError);
    notebook.deleteTrace('notebook-child');
    notebook.deleteTrace('notebook-baseline');
    expect(notebook.report()).toEqual({
      approximateBytes: 0,
      payloadCount: 0,
      payloadReferences: 0,
      traceCount: 0,
    });
  });

  it('leaves prior records intact when quota preflight fails', async () => {
    const bundle = await baselineBundle();
    const probe = new MemoryTraceNotebook();
    probe.saveBundle(bundle);
    const required = probe.report().approximateBytes;
    const notebook = new MemoryTraceNotebook(required - 1);

    expect(() => notebook.saveBundle(bundle)).toThrow(NotebookQuotaError);
    expect(notebook.report().traceCount).toBe(0);
  });

  it('rejects attempts to rewrite an existing committed step', async () => {
    const notebook = new MemoryTraceNotebook();
    const baseline = await baselineBundle();
    notebook.saveBundle(baseline);
    const trace = baseline.traces[0];
    const step = trace?.steps[0];
    if (!trace || !step) throw new Error('Expected a saved step.');
    const mutated = {
      ...baseline,
      traces: [
        {
          ...trace,
          steps: [
            {
              ...step,
              sampler: {
                ...step.sampler,
                selection: { ...step.sampler.selection, tokenId: 1 },
              },
            },
          ],
        },
      ],
    };

    expect(() => notebook.saveBundle(mutated)).toThrow(/replay|mutate/);
    expect(notebook.exportBundle('notebook-baseline').traces[0]?.steps[0]).toEqual(step);
  });

  it('rejects immutable lineage edits and annotation removal', async () => {
    const notebook = new MemoryTraceNotebook();
    const baseline = await baselineBundle();
    notebook.saveBundle(baseline);
    const trace = baseline.traces[0];
    if (!trace) throw new Error('Expected a baseline trace.');

    expect(() =>
      notebook.saveBundle({
        ...baseline,
        traces: [{ ...trace, rootSeed: 'rewritten-root-seed' }],
      }),
    ).toThrow('rewrite immutable lineage');

    const annotated = {
      ...baseline,
      traces: [
        {
          ...trace,
          annotations: [
            {
              createdAt: '2026-08-24T00:03:00.000Z',
              id: 'observation-1',
              note: 'Keep this append-only observation.',
              step: 0,
            },
          ],
        },
      ],
    };
    notebook.saveBundle(annotated);
    expect(() => notebook.saveBundle(baseline)).toThrow('remove annotations');
  });
});
