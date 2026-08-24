import type { ExperimentTrace } from '@observatory/domain';
import { parseTraceJson, serialiseTrace } from '@observatory/trace-schema';

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
