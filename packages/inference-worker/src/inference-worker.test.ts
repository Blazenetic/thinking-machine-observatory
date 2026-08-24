import { describe, expect, it } from 'vitest';

import { detectRuntimeCapabilities, DISTILGPT2_MODEL } from './index';

describe('inference boundary', () => {
  it('pins the experimental model revision', () => {
    expect(DISTILGPT2_MODEL.revision).toMatch(/^[a-f0-9]{40}$/);
  });

  it('detects capabilities without assuming browser globals', () => {
    expect(
      detectRuntimeCapabilities({
        Worker: class Worker {},
        indexedDB: {},
        isSecureContext: true,
        navigator: { gpu: {} },
      }),
    ).toEqual({ indexedDb: true, secureContext: true, webGpu: true, webWorker: true });
    expect(detectRuntimeCapabilities({ navigator: {} })).toEqual({
      indexedDb: false,
      secureContext: false,
      webGpu: false,
      webWorker: false,
    });
  });
});
