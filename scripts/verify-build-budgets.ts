import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const assetsDirectory = resolve(root, 'apps/observatory/dist/assets');

function files(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const assets = files(assetsDirectory);
const workerJavaScript = assets.filter(
  (path) => path.endsWith('.js') && basename(path).includes('inference.worker'),
);
const appJavaScript = assets.filter(
  (path) => path.endsWith('.js') && !workerJavaScript.includes(path),
);
const css = assets.filter((path) => path.endsWith('.css'));
if (appJavaScript.length === 0 || workerJavaScript.length !== 1 || css.length === 0) {
  throw new Error('Production assets could not be classified for the Phase 5 budgets.');
}

const sum = (paths: readonly string[], transform: (bytes: Buffer) => number): number =>
  paths.reduce((total, path) => total + transform(readFileSync(path)), 0);
const report = {
  appJavaScriptGzipBytes: sum(appJavaScript, (bytes) => gzipSync(bytes).byteLength),
  appJavaScriptLimitBytes: 125 * 1024,
  cssGzipBytes: sum(css, (bytes) => gzipSync(bytes).byteLength),
  cssLimitBytes: 10 * 1024,
  workerJavaScriptBytes: sum(workerJavaScript, (bytes) => bytes.byteLength),
  workerJavaScriptLimitBytes: 1024 * 1024,
};

const failures = [
  ['application JavaScript gzip', report.appJavaScriptGzipBytes, report.appJavaScriptLimitBytes],
  ['application CSS gzip', report.cssGzipBytes, report.cssLimitBytes],
  ['worker JavaScript', report.workerJavaScriptBytes, report.workerJavaScriptLimitBytes],
] as const;
for (const [label, observed, limit] of failures) {
  if (observed > limit) throw new Error(`${label} is ${observed} bytes; budget is ${limit} bytes.`);
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const checked = JSON.parse(
    readFileSync(resolve(root, 'release-evidence/reports/bundle-budget.json'), 'utf8'),
  ) as typeof report;
  if (JSON.stringify(checked) !== JSON.stringify(report)) {
    throw new Error('Checked bundle-budget report is stale for the current production build.');
  }
  console.log(`Build budgets passed: ${JSON.stringify(report)}.`);
}
