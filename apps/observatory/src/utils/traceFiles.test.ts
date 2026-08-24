import { describe, expect, it, vi } from 'vitest';

import { COMPACT_TRACE_LIMITS } from '@observatory/trace-schema';

import { readPortableTraceFile, readTraceFile } from './traceFiles';

function oversizedFile(): { readonly file: File; readonly text: ReturnType<typeof vi.fn> } {
  const text = vi.fn(() => Promise.resolve('{}'));
  const file = {
    size: COMPACT_TRACE_LIMITS.importBytes + 1,
    text,
  } as unknown as File;
  return { file, text };
}

describe('trace file boundaries', () => {
  it('rejects oversized portable files before reading them into memory', async () => {
    const { file, text } = oversizedFile();

    await expect(readPortableTraceFile(file)).rejects.toThrow('Trace import exceeds');
    expect(text).not.toHaveBeenCalled();
  });

  it('applies the same pre-read limit to legacy expanded traces', async () => {
    const { file, text } = oversizedFile();

    await expect(readTraceFile(file)).rejects.toThrow('Trace import exceeds');
    expect(text).not.toHaveBeenCalled();
  });
});
