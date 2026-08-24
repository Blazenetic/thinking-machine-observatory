import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerOfflineShell } from './registerOfflineShell';

describe('offline shell registration', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not register a production cache from the development/test runtime', () => {
    const addEventListener = vi.spyOn(globalThis, 'addEventListener');
    registerOfflineShell();
    expect(addEventListener).not.toHaveBeenCalled();
  });
});
