import type { ExperimentTrace } from '@observatory/domain';
import {
  COMPACT_TRACE_LIMITS,
  parsePortableTraceJson,
  parseTraceJson,
  serialiseCompactTraceBundle,
  serialiseTrace,
  TraceValidationError,
  type CompactTraceBundle,
} from '@observatory/trace-schema';

function downloadJson(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function assertImportFileSize(file: File): void {
  if (file.size > COMPACT_TRACE_LIMITS.importBytes) {
    throw new TraceValidationError(
      `Trace import exceeds ${COMPACT_TRACE_LIMITS.importBytes} bytes.`,
    );
  }
}

export function traceByteLength(trace: ExperimentTrace): number {
  return new TextEncoder().encode(serialiseTrace(trace)).byteLength;
}

export function downloadTrace(trace: ExperimentTrace): void {
  downloadJson(serialiseTrace(trace), `${trace.traceId}.observatory-trace.json`);
}

export async function readTraceFile(file: File): Promise<ExperimentTrace> {
  assertImportFileSize(file);
  return parseTraceJson(await file.text());
}

export function portableTraceByteLength(bundle: CompactTraceBundle): number {
  return new TextEncoder().encode(serialiseCompactTraceBundle(bundle)).byteLength;
}

export function downloadPortableTrace(bundle: CompactTraceBundle): void {
  downloadJson(
    serialiseCompactTraceBundle(bundle),
    `${bundle.rootTraceId}.observatory-bundle.json`,
  );
}

export async function readPortableTraceFile(file: File): Promise<CompactTraceBundle> {
  assertImportFileSize(file);
  return parsePortableTraceJson(await file.text());
}
