import { describe, expect, it } from 'vitest';

import {
  renderReleaseSummary,
  sourceCandidateDrift,
  summariseRelease,
  validateManifest,
  type AcceptanceLedger,
  type ReleaseManifest,
} from './release-evidence.ts';

const ledger: AcceptanceLedger = {
  groups: [
    {
      criteria: [
        { id: 'TMO-TEST-001', paths: ['release'], requirement: 'Blocking check' },
        {
          id: 'TMO-TEST-002',
          paths: ['release'],
          requirement: 'Advisory check',
          severity: 'advisory',
          severityReason: 'Does not carry the core path.',
        },
      ],
      defaultSeverity: 'launch-blocking',
      id: 'test',
      severityReason: 'Required for release.',
      title: 'Test criteria',
    },
  ],
  profileVersion: '1.0.0',
  source: 'docs/07-acceptance-criteria-and-test-plan.md',
};

function manifest(result: 'blocked' | 'failed' | 'not-run' | 'passed'): ReleaseManifest {
  return {
    $schema: './release-evidence.schema.json',
    candidate: {
      commit: 'a'.repeat(40),
      label: 'test',
      lockfile: { path: 'pnpm-lock.yaml', sha256: 'b'.repeat(64) },
      runtime: { node: '24.x', packageManager: 'pnpm@11.19.0' },
    },
    environments: [
      {
        capabilities: { runner: 'fixture' },
        deviceClass: 'ephemeral development runner',
        id: 'test-runner',
        operatingSystem: 'Linux x86_64 harness',
      },
    ],
    evidence: [
      {
        artifacts: ['test-report.json'],
        criteria: ['TMO-TEST-001', 'TMO-TEST-002'],
        environments: result === 'passed' ? ['test-runner'] : [],
        id: 'EV-TEST',
        limitation: result === 'passed' ? '' : `${result} remains unresolved.`,
        method: {
          description: 'Test protocol',
          kind: result === 'passed' ? 'automated' : 'not-run',
        },
        ...(result === 'passed'
          ? { observedAt: '2026-08-24T00:00:00.000Z', reviewer: 'test-runner' }
          : {}),
        result,
      },
    ],
    profileVersion: '1.0.0',
  };
}

describe('release evidence', () => {
  it.each(['blocked', 'failed', 'not-run'] as const)(
    'never promotes %s to a launch pass',
    (result) => {
      const summary = summariseRelease(ledger, manifest(result));
      expect(summary.launchReady).toBe(false);
      expect(summary.launchBlockers).toHaveLength(1);
      expect(renderReleaseSummary(ledger, manifest(result))).toContain('Decision: **NOT READY**');
    },
  );

  it('separates passed blocking criteria from unresolved advisory evidence', () => {
    const candidate = manifest('passed');
    const passedEvidence = candidate.evidence[0]!;
    const split: ReleaseManifest = {
      ...candidate,
      evidence: [
        { ...passedEvidence, criteria: ['TMO-TEST-001'] },
        {
          artifacts: [],
          criteria: ['TMO-TEST-002'],
          environments: [],
          id: 'EV-ADVISORY',
          limitation: 'Optional environment unavailable.',
          method: { description: 'Not available', kind: 'not-run' },
          result: 'not-run',
        },
      ],
    };
    const summary = summariseRelease(ledger, split);
    expect(summary.launchReady).toBe(true);
    expect(summary.advisoryGaps).toHaveLength(1);
  });

  it('rejects duplicate criterion coverage', () => {
    const candidate = manifest('not-run');
    const duplicate: ReleaseManifest = {
      ...candidate,
      evidence: [...candidate.evidence, { ...candidate.evidence[0]!, id: 'EV-DUPLICATE' }],
    };
    expect(() => validateManifest(ledger, duplicate)).toThrow(/Criteria coverage/);
  });

  it('rejects a passing measurement that misses its threshold', () => {
    const candidate = manifest('passed');
    const invalid: ReleaseManifest = {
      ...candidate,
      evidence: [
        {
          ...candidate.evidence[0]!,
          measurements: [
            { comparison: 'at-most', name: 'bundle', threshold: 10, unit: 'bytes', value: 11 },
          ],
        },
      ],
    };
    expect(() => validateManifest(ledger, invalid)).toThrow(/misses bundle threshold/);
  });

  it('rejects a pass whose limitation still claims the record remains blocked', () => {
    const candidate = manifest('passed');
    const invalid: ReleaseManifest = {
      ...candidate,
      evidence: [
        {
          ...candidate.evidence[0]!,
          limitation: 'Grouped live and manual criteria remain unresolved.',
        },
      ],
    };
    expect(() => validateManifest(ledger, invalid)).toThrow(/cannot claim it remains blocked/);
  });

  it('rejects a manifest that omits $schema', () => {
    const candidate = manifest('passed');
    expect(() => validateManifest(ledger, { ...candidate, $schema: '' })).toThrow(/\$schema/);
  });

  it('rejects environments that omit host identity fields', () => {
    const candidate = manifest('passed');
    const invalid = {
      ...candidate,
      environments: [{ capabilities: { runner: 'fixture' }, id: 'test-runner' }],
    } as unknown as ReleaseManifest;
    expect(() => validateManifest(ledger, invalid)).toThrow(/operatingSystem/);
  });

  it('treats application and test paths as frozen source-candidate inputs', () => {
    expect(sourceCandidateDrift(['release-evidence/manifest.json', 'docs/user-guide.md'])).toEqual(
      [],
    );
    expect(
      sourceCandidateDrift([
        'apps/observatory/src/App.tsx',
        'packages/sampler/src/index.ts',
        'tests/e2e/hero-loop.spec.ts',
        'docs/architecture/README.md',
      ]),
    ).toEqual([
      'apps/observatory/src/App.tsx',
      'packages/sampler/src/index.ts',
      'tests/e2e/hero-loop.spec.ts',
    ]);
  });
});
