import { expect, test, type Page } from '@playwright/test';

async function installVerifiedFixtureWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface FixtureRequest {
      readonly backend?: 'wasm' | 'webgpu';
      readonly context: {
        readonly generationId: string;
        readonly requestOrder: number;
        readonly workerEpoch: number;
      };
      readonly id: string;
      readonly inputTokenIds?: readonly number[];
      readonly prompt?: string;
      readonly topN?: number;
      readonly type: 'dispose' | 'load' | 'predict';
    }

    class FixtureWorker {
      readonly #listeners = new Map<string, Set<EventListener>>();
      #terminated = false;

      public addEventListener(type: string, listener: EventListener): void {
        const listeners = this.#listeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        this.#listeners.set(type, listeners);
      }

      #emit(type: string, event: Event): void {
        for (const listener of this.#listeners.get(type) ?? []) listener(event);
      }

      public postMessage(request: FixtureRequest): void {
        if (this.#terminated) return;
        if (request.type === 'load') {
          setTimeout(() => {
            if (this.#terminated) return;
            this.#emit(
              'message',
              new MessageEvent('message', {
                data: {
                  context: request.context,
                  id: request.id,
                  load: {
                    cacheStatus: 'warm-cache',
                    durationMs: 1,
                    modelAssetBytes: 327_825_716,
                  },
                  model: {
                    assetHash:
                      'sha256:d605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c',
                    dtype: 'fp32',
                    id: 'Xenova/distilgpt2',
                    revision: 'a41c10485c18a64b6606729b6a082330cbd8f49e',
                    runtime:
                      '@huggingface/transformers@3.8.1; onnxruntime-web@1.22.0-dev.20250409-89f8206ba4',
                    verificationStatus: 'verified',
                  },
                  type: 'ready',
                },
              }),
            );
          });
          return;
        }
        if (request.type === 'dispose') {
          this.#emit(
            'message',
            new MessageEvent('message', {
              data: { context: request.context, id: request.id, type: 'disposed' },
            }),
          );
          return;
        }
        void (async () => {
          const inputTokenIds = request.inputTokenIds ?? [464, 1755, 6766, 373];
          const logits = new Float32Array(50_257).fill(-30);
          const topTokenId = 1_000 + inputTokenIds.length * 3;
          logits[topTokenId] = 12;
          logits[topTokenId + 1] = 11;
          logits[topTokenId + 2] = 10;
          const digest = await globalThis.crypto.subtle.digest('SHA-256', logits.buffer.slice(0));
          const logitsSha256 = [...new Uint8Array(digest)]
            .map((value) => value.toString(16).padStart(2, '0'))
            .join('');
          if (this.#terminated) return;
          this.#emit(
            'message',
            new MessageEvent('message', {
              data: {
                capture: {
                  candidateUniverse: {
                    captured: 50_257,
                    complete: true,
                    label: 'Complete 50,257-logit fixture vocabulary',
                    size: 50_257,
                  },
                  candidates: [
                    { logit: 12, text: ` token-${topTokenId}`, tokenId: topTokenId },
                    { logit: 11, text: ` alt-${topTokenId + 1}`, tokenId: topTokenId + 1 },
                    { logit: 10, text: ` third-${topTokenId + 2}`, tokenId: topTokenId + 2 },
                  ],
                  durationMs: 2,
                  logits,
                  logitsSha256,
                  mode: 'live-wasm',
                  model: {
                    assetHash:
                      'sha256:d605c4b3740df3960e8f84e4c5735af8d81d19105eb915b692272c08cc800b0c',
                    dtype: 'fp32',
                    id: 'Xenova/distilgpt2',
                    revision: 'a41c10485c18a64b6606729b6a082330cbd8f49e',
                    runtime:
                      '@huggingface/transformers@3.8.1; onnxruntime-web@1.22.0-dev.20250409-89f8206ba4',
                    verificationStatus: 'verified',
                  },
                  promptTokens: inputTokenIds.map((tokenId, position) => ({
                    byteValues: [],
                    position,
                    text: position < 4 ? ['The', ' night', ' sky', ' was'][position] : '',
                    tokenId,
                  })),
                  tokenizer: {
                    assetHash:
                      'sha256:fb803549cd431422aa2398fd669a1b2cff3ac8c57ff5843d9a65869a4df0b592',
                    id: 'Xenova/distilgpt2',
                    revision: 'a41c10485c18a64b6606729b6a082330cbd8f49e',
                  },
                  verificationProfileId: 'distilgpt2-wasm-fp32-v1',
                },
                context: request.context,
                id: request.id,
                type: 'prediction',
              },
            }),
          );
        })();
      }

      public terminate(): void {
        this.#terminated = true;
      }
    }

    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: FixtureWorker,
      writable: true,
    });
  });
}

test('runs a compact multi-step branch and round-trips its local evidence', async ({ page }) => {
  await installVerifiedFixtureWorker(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Load verified WASM' }).click();
  await expect(page.getByRole('button', { name: 'Start new baseline' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start new baseline' }).click();
  await expect(page.getByText(/Paused before selection 1/)).toBeVisible();
  await expect(page.getByText('50,257 complete logits')).toBeVisible();

  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Advance one token' }).click();
  await expect(page.getByText(/Paused before selection 3/)).toBeVisible();

  await page.getByRole('button', { name: 'Fork decoded alternative' }).click();
  await expect(page.getByText(/First selection divergence: step 1/)).toBeVisible();
  await expect(page.getByText(/preserved the baseline bytes/)).toBeVisible();

  await page.getByRole('button', { name: 'Save to local notebook' }).click();
  await expect(page.getByText(/Saved 2 traces with 2 deduplicated payloads locally/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ancestry bundle' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Playwright did not expose the downloaded bundle.');

  await page.getByLabel('Import 1.0 / 1.1 / 1.2').setInputFiles(path);
  await expect(page.getByText(/effective steps replayed exactly/)).toBeVisible();
  await expect(page.getByText(/KiB/).last()).toBeVisible();
});
