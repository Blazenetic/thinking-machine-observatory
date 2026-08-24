import type { TraceParent } from '@observatory/domain';

import {
  COMPACT_TRACE_SCHEMA_VERSION,
  type CompactTraceBundle,
  type CompactTraceNode,
  validateCompactTraceBundle,
} from './compact.ts';
import type { EmbeddedFloat32Payload } from './logit-payload.ts';

export interface NotebookTraceMetadata {
  readonly createdAt: string;
  readonly parent: TraceParent | null;
  readonly stepCount: number;
  readonly title: string;
  readonly traceId: string;
  readonly updatedAt: string;
}

export interface NotebookDataReport {
  readonly approximateBytes: number;
  readonly payloadCount: number;
  readonly payloadReferences: number;
  readonly traceCount: number;
}

interface StoredPayload {
  readonly payload: EmbeddedFloat32Payload;
  readonly refCount: number;
  readonly sha256: string;
}

interface NotebookState {
  readonly metadata: Map<string, NotebookTraceMetadata>;
  readonly payloads: Map<string, StoredPayload>;
  readonly traces: Map<string, CompactTraceNode>;
}

export class NotebookError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'NotebookError';
  }
}

export class NotebookQuotaError extends NotebookError {
  public constructor(message = 'Local notebook quota is insufficient for this transaction.') {
    super(message);
    this.name = 'NotebookQuotaError';
  }
}

function canonicalJson(value: unknown): string {
  const normalise = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalise);
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalise(nested)]),
      );
    }
    return item;
  };
  return JSON.stringify(normalise(value));
}

function emptyState(): NotebookState {
  return { metadata: new Map(), payloads: new Map(), traces: new Map() };
}

function cloneState(state: NotebookState): NotebookState {
  return {
    metadata: new Map(state.metadata),
    payloads: new Map(state.payloads),
    traces: new Map(state.traces),
  };
}

function traceCore(trace: CompactTraceNode): unknown {
  return {
    calculationVersions: trace.calculationVersions,
    createdAt: trace.createdAt,
    mode: trace.mode,
    model: trace.model,
    parent: trace.parent,
    prompt: trace.prompt,
    promptTokens: trace.promptTokens,
    rootSeed: trace.rootSeed,
    tokenizer: trace.tokenizer,
    traceId: trace.traceId,
  };
}

function assertAppendOnly(previous: CompactTraceNode, next: CompactTraceNode): void {
  if (canonicalJson(traceCore(previous)) !== canonicalJson(traceCore(next))) {
    throw new NotebookError(`Trace ${next.traceId} attempted to rewrite immutable lineage.`);
  }
  if (next.steps.length < previous.steps.length) {
    throw new NotebookError(`Trace ${next.traceId} attempted to remove committed steps.`);
  }
  if (canonicalJson(next.steps.slice(0, previous.steps.length)) !== canonicalJson(previous.steps)) {
    throw new NotebookError(`Trace ${next.traceId} attempted to mutate a committed step.`);
  }
  if (next.annotations.length < previous.annotations.length) {
    throw new NotebookError(`Trace ${next.traceId} attempted to remove annotations.`);
  }
  if (
    canonicalJson(next.annotations.slice(0, previous.annotations.length)) !==
    canonicalJson(previous.annotations)
  ) {
    throw new NotebookError(`Trace ${next.traceId} attempted to mutate an annotation.`);
  }
}

function changePayloadReference(
  state: NotebookState,
  sha256: string,
  delta: number,
  payload?: EmbeddedFloat32Payload,
): void {
  const existing = state.payloads.get(sha256);
  if (existing && payload && canonicalJson(existing.payload) !== canonicalJson(payload)) {
    throw new NotebookError(`Payload ${sha256} collided with different bytes.`);
  }
  const refCount = (existing?.refCount ?? 0) + delta;
  if (refCount < 0) throw new NotebookError(`Payload ${sha256} reference count became negative.`);
  if (refCount === 0) {
    state.payloads.delete(sha256);
    return;
  }
  const resolved = existing?.payload ?? payload;
  if (!resolved) throw new NotebookError(`Payload ${sha256} bytes are missing.`);
  state.payloads.set(sha256, { payload: resolved, refCount, sha256 });
}

function saveBundleToState(
  current: NotebookState,
  input: CompactTraceBundle,
  updatedAt: string,
): NotebookState {
  const bundle = validateCompactTraceBundle(input);
  const next = cloneState(current);
  for (const trace of bundle.traces) {
    const previous = next.traces.get(trace.traceId);
    if (previous) {
      assertAppendOnly(previous, trace);
      for (const step of previous.steps) changePayloadReference(next, step.logitsRef, -1);
    }
    for (const step of trace.steps) {
      changePayloadReference(next, step.logitsRef, 1, bundle.payloads[step.logitsRef]);
    }
    next.traces.set(trace.traceId, trace);
    next.metadata.set(trace.traceId, {
      createdAt: trace.createdAt,
      parent: trace.parent,
      stepCount: trace.steps.length,
      title: trace.title,
      traceId: trace.traceId,
      updatedAt,
    });
  }
  return next;
}

function deleteTraceFromState(current: NotebookState, traceId: string): NotebookState {
  const trace = current.traces.get(traceId);
  if (!trace) throw new NotebookError(`Trace ${traceId} does not exist in the notebook.`);
  const descendants = [...current.traces.values()].filter(
    (candidate) => candidate.parent?.traceId === traceId,
  );
  if (descendants.length > 0) {
    throw new NotebookError(
      `Trace ${traceId} has ${descendants.length} direct descendant${descendants.length === 1 ? '' : 's'}; delete descendants first.`,
    );
  }
  const next = cloneState(current);
  for (const step of trace.steps) changePayloadReference(next, step.logitsRef, -1);
  next.traces.delete(traceId);
  next.metadata.delete(traceId);
  return next;
}

function bundleFromState(
  state: NotebookState,
  traceId: string,
  exportedAt: string,
): CompactTraceBundle {
  const trace = state.traces.get(traceId);
  if (!trace) throw new NotebookError(`Trace ${traceId} does not exist in the notebook.`);
  const ancestry: CompactTraceNode[] = [];
  const seen = new Set<string>();
  let cursor: CompactTraceNode | undefined = trace;
  while (cursor) {
    if (seen.has(cursor.traceId))
      throw new NotebookError('Stored trace ancestry contains a cycle.');
    seen.add(cursor.traceId);
    ancestry.unshift(cursor);
    cursor = cursor.parent ? state.traces.get(cursor.parent.traceId) : undefined;
    if (ancestry[0]?.parent && !cursor) {
      throw new NotebookError(`Stored ancestor ${ancestry[0].parent.traceId} is missing.`);
    }
  }
  const payloads: Record<string, EmbeddedFloat32Payload> = {};
  for (const item of ancestry) {
    for (const step of item.steps) {
      const stored = state.payloads.get(step.logitsRef);
      if (!stored) throw new NotebookError(`Stored payload ${step.logitsRef} is missing.`);
      payloads[step.logitsRef] = stored.payload;
    }
  }
  return validateCompactTraceBundle({
    exportedAt,
    payloads,
    rootTraceId: traceId,
    schemaVersion: COMPACT_TRACE_SCHEMA_VERSION,
    traces: ancestry,
  });
}

function dataReport(state: NotebookState): NotebookDataReport {
  const traceJson = [...state.traces.values()].map((trace) => canonicalJson(trace)).join('');
  const payloadJson = [...state.payloads.values()]
    .map((payload) => canonicalJson(payload))
    .join('');
  return {
    approximateBytes: new TextEncoder().encode(traceJson + payloadJson).byteLength,
    payloadCount: state.payloads.size,
    payloadReferences: [...state.payloads.values()].reduce(
      (sum, payload) => sum + payload.refCount,
      0,
    ),
    traceCount: state.traces.size,
  };
}

export class MemoryTraceNotebook {
  #state = emptyState();
  readonly #quotaBytes: number | null;

  public constructor(quotaBytes: number | null = null) {
    this.#quotaBytes = quotaBytes;
  }

  public saveBundle(bundle: CompactTraceBundle, updatedAt = new Date().toISOString()): void {
    const next = saveBundleToState(this.#state, bundle, updatedAt);
    const report = dataReport(next);
    if (this.#quotaBytes !== null && report.approximateBytes > this.#quotaBytes) {
      throw new NotebookQuotaError();
    }
    this.#state = next;
  }

  public deleteTrace(traceId: string): void {
    this.#state = deleteTraceFromState(this.#state, traceId);
  }

  public exportBundle(traceId: string, exportedAt = new Date().toISOString()): CompactTraceBundle {
    return bundleFromState(this.#state, traceId, exportedAt);
  }

  public listTraces(): readonly NotebookTraceMetadata[] {
    return [...this.#state.metadata.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  public report(): NotebookDataReport {
    return dataReport(this.#state);
  }
}

const DATABASE_VERSION = 1;
const TRACE_STORE = 'traces';
const PAYLOAD_STORE = 'payloads';
const METADATA_STORE = 'metadata';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new NotebookError('IndexedDB request failed.')),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new NotebookError('IndexedDB transaction aborted.')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new NotebookError('IndexedDB transaction failed.')),
      { once: true },
    );
  });
}

function stateFromRecords(
  traces: readonly CompactTraceNode[],
  payloads: readonly StoredPayload[],
  metadata: readonly NotebookTraceMetadata[],
): NotebookState {
  return {
    metadata: new Map(metadata.map((item) => [item.traceId, item])),
    payloads: new Map(payloads.map((item) => [item.sha256, item])),
    traces: new Map(traces.map((item) => [item.traceId, item])),
  };
}

async function readState(transaction: IDBTransaction): Promise<NotebookState> {
  const [traces, payloads, metadata] = await Promise.all([
    requestResult(transaction.objectStore(TRACE_STORE).getAll() as IDBRequest<CompactTraceNode[]>),
    requestResult(transaction.objectStore(PAYLOAD_STORE).getAll() as IDBRequest<StoredPayload[]>),
    requestResult(
      transaction.objectStore(METADATA_STORE).getAll() as IDBRequest<NotebookTraceMetadata[]>,
    ),
  ]);
  return stateFromRecords(traces, payloads, metadata);
}

function replaceState(transaction: IDBTransaction, state: NotebookState): void {
  const traceStore = transaction.objectStore(TRACE_STORE);
  const payloadStore = transaction.objectStore(PAYLOAD_STORE);
  const metadataStore = transaction.objectStore(METADATA_STORE);
  traceStore.clear();
  payloadStore.clear();
  metadataStore.clear();
  for (const trace of state.traces.values()) traceStore.put(trace);
  for (const payload of state.payloads.values()) payloadStore.put(payload);
  for (const metadata of state.metadata.values()) metadataStore.put(metadata);
}

function quotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

export class IndexedDbTraceNotebook {
  readonly #database: IDBDatabase;
  #writeQueue: Promise<void> = Promise.resolve();

  private constructor(database: IDBDatabase) {
    this.#database = database;
  }

  public static async open(
    name = 'thinking-machine-observatory-notebook-v1',
  ): Promise<IndexedDbTraceNotebook> {
    if (!('indexedDB' in globalThis)) throw new NotebookError('IndexedDB is unavailable.');
    const request = globalThis.indexedDB.open(name, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRACE_STORE)) {
        database.createObjectStore(TRACE_STORE, { keyPath: 'traceId' });
      }
      if (!database.objectStoreNames.contains(PAYLOAD_STORE)) {
        database.createObjectStore(PAYLOAD_STORE, { keyPath: 'sha256' });
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'traceId' });
      }
    });
    return new IndexedDbTraceNotebook(await requestResult(request));
  }

  async #read(): Promise<NotebookState> {
    const transaction = this.#database.transaction(
      [TRACE_STORE, PAYLOAD_STORE, METADATA_STORE],
      'readonly',
    );
    const completion = transactionComplete(transaction);
    const state = await readState(transaction);
    await completion;
    return state;
  }

  #enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const queued = this.#writeQueue.then(operation);
    this.#writeQueue = queued.catch(() => undefined);
    return queued;
  }

  public async saveBundle(bundle: CompactTraceBundle): Promise<void> {
    return this.#enqueueWrite(async () => {
      const before = await this.#read();
      const next = saveBundleToState(before, bundle, new Date().toISOString());
      const beforeBytes = dataReport(before).approximateBytes;
      const nextBytes = dataReport(next).approximateBytes;
      const estimate = await globalThis.navigator?.storage?.estimate?.();
      if (
        estimate?.quota !== undefined &&
        estimate.usage !== undefined &&
        estimate.usage + Math.max(0, nextBytes - beforeBytes) > estimate.quota * 0.9
      ) {
        throw new NotebookQuotaError('Saving would exceed the notebook safety margin.');
      }
      const transaction = this.#database.transaction(
        [TRACE_STORE, PAYLOAD_STORE, METADATA_STORE],
        'readwrite',
      );
      const completion = transactionComplete(transaction);
      try {
        replaceState(transaction, next);
        await completion;
      } catch (error) {
        if (quotaError(error)) throw new NotebookQuotaError();
        throw error;
      }
    });
  }

  public async deleteTrace(traceId: string): Promise<void> {
    return this.#enqueueWrite(async () => {
      const next = deleteTraceFromState(await this.#read(), traceId);
      const transaction = this.#database.transaction(
        [TRACE_STORE, PAYLOAD_STORE, METADATA_STORE],
        'readwrite',
      );
      const completion = transactionComplete(transaction);
      replaceState(transaction, next);
      await completion;
    });
  }

  public async exportBundle(traceId: string): Promise<CompactTraceBundle> {
    await this.#writeQueue;
    return bundleFromState(await this.#read(), traceId, new Date().toISOString());
  }

  public async listTraces(): Promise<readonly NotebookTraceMetadata[]> {
    await this.#writeQueue;
    return [...(await this.#read()).metadata.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  public async report(): Promise<NotebookDataReport> {
    await this.#writeQueue;
    return dataReport(await this.#read());
  }

  public close(): void {
    this.#database.close();
  }
}
