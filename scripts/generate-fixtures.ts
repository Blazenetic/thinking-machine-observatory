import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { serialiseTrace } from '../packages/trace-schema/src/index.ts';

import {
  createBaselineTrace,
  createDemoBranch,
  DEMO_CANDIDATES,
  WORKBENCH_CONFIG,
} from '../apps/observatory/src/data/demo.ts';

const fixtureDirectory = resolve('fixtures/traces');
const baseline = createBaselineTrace();
const runnerUp = createDemoBranch(baseline, {
  branchNumber: 1,
  config: WORKBENCH_CONFIG,
  createdAt: '2026-08-24T00:01:00.000Z',
  interventions: {
    forcedTokenId: DEMO_CANDIDATES[1]?.tokenId ?? null,
    suppressedTokenIds: [],
  },
  title: 'Forced “dark”',
});

const fixtures = new Map([
  [resolve(fixtureDirectory, 'demo-baseline.observatory-trace.json'), serialiseTrace(baseline)],
  [resolve(fixtureDirectory, 'demo-runner-up.observatory-trace.json'), serialiseTrace(runnerUp)],
]);

await mkdir(fixtureDirectory, { recursive: true });

if (process.argv.includes('--check')) {
  const stale: string[] = [];
  for (const [path, expected] of fixtures) {
    let actual: string;
    try {
      actual = await readFile(path, 'utf8');
    } catch {
      stale.push(path);
      continue;
    }
    if (actual !== expected) stale.push(path);
  }
  if (stale.length > 0) {
    throw new Error(
      `Trace fixtures are stale or missing:\n${stale.join('\n')}\nRun pnpm fixtures:generate.`,
    );
  }
  console.log(`Verified ${fixtures.size} trace fixtures.`);
} else {
  for (const [path, contents] of fixtures) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, 'utf8');
  }
  console.log(`Generated ${fixtures.size} trace fixtures.`);
}
