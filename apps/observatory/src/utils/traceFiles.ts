import type { ExperimentTrace } from '@observatory/domain';
import {
  parsePortableTraceJson,
  parseTraceJson,
  serialiseCompactTraceBundle,
  serialiseTrace,
  type CompactTraceBundle,
} from '@observatory/trace-schema';

export function traceByteLength(trace: ExperimentTrace): number {
  return new TextEncoder().encode(serialiseTrace(trace)).byteLength;
}

export function downloadTrace(trace: ExperimentTrace): void {
  const blob = new Blob([serialiseTrace(trace)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${trace.traceId}.observatory-trace.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readTraceFile(file: File): Promise<ExperimentTrace> {
  return parseTraceJson(await file.text());
}

export function portableTraceByteLength(bundle: CompactTraceBundle): number {
  return new TextEncoder().encode(serialiseCompactTraceBundle(bundle)).byteLength;
}

export function downloadPortableTrace(bundle: CompactTraceBundle): void {
  const blob = new Blob([serialiseCompactTraceBundle(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${bundle.rootTraceId}.observatory-bundle.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readPortableTraceFile(file: File): Promise<CompactTraceBundle> {
  return parsePortableTraceJson(await file.text());
}
