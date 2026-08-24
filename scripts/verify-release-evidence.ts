import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, normalize, resolve } from 'node:path';

import {
  renderReleaseSummary,
  summariseRelease,
  validateManifest,
  type AcceptanceLedger,
  type ReleaseManifest,
} from './lib/release-evidence.ts';

const root = resolve(import.meta.dirname, '..');
const ledgerPath = resolve(root, 'release-evidence/acceptance-ledger.json');
const manifestPath = resolve(root, 'release-evidence/manifest.json');
const summaryPath = resolve(root, 'release-evidence/summary.md');

function readJson<Value>(path: string): Value {
  return JSON.parse(readFileSync(path, 'utf8')) as Value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeRepositoryPath(path: string): string {
  const normalised = normalize(path);
  assert(!isAbsolute(path), `Evidence artifact must be repository-relative: ${path}.`);
  assert(!normalised.startsWith('..'), `Evidence artifact escapes the repository: ${path}.`);
  return resolve(root, normalised);
}

const ledger = readJson<AcceptanceLedger>(ledgerPath);
const manifest = readJson<ReleaseManifest>(manifestPath);
validateManifest(ledger, manifest);

const candidate = manifest.candidate.commit;
execFileSync('git', ['cat-file', '-e', `${candidate}^{commit}`], { cwd: root });
const lockfileAtCandidate = execFileSync(
  'git',
  ['show', `${candidate}:${manifest.candidate.lockfile.path}`],
  { cwd: root },
);
const lockfileHash = createHash('sha256').update(lockfileAtCandidate).digest('hex');
assert(
  lockfileHash === manifest.candidate.lockfile.sha256,
  `Candidate lockfile hash mismatch: expected ${manifest.candidate.lockfile.sha256}, observed ${lockfileHash}.`,
);

for (const evidence of manifest.evidence) {
  for (const artifact of evidence.artifacts) {
    const path = safeRepositoryPath(artifact);
    readFileSync(path);
  }
}

const rendered = renderReleaseSummary(ledger, manifest);
if (process.argv.includes('--print-summary')) {
  process.stdout.write(rendered);
} else {
  const checked = readFileSync(summaryPath, 'utf8');
  assert(
    checked === rendered,
    'release-evidence/summary.md is stale; regenerate it from the manifest.',
  );
  const summary = summariseRelease(ledger, manifest);
  console.log(
    `Release evidence valid: ${summary.resolved.size} criteria, ${summary.launchBlockers.length} launch blockers, decision ${summary.launchReady ? 'READY' : 'NOT READY'}.`,
  );
}
