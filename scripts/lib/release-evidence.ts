export type EvidenceResult = 'blocked' | 'failed' | 'not-run' | 'passed';
export type EvidenceSeverity = 'advisory' | 'launch-blocking' | 'not-applicable';

export interface AcceptanceCriterion {
  readonly id: string;
  readonly paths: readonly string[];
  readonly requirement: string;
  readonly severity?: EvidenceSeverity;
  readonly severityReason?: string;
}

export interface AcceptanceGroup {
  readonly criteria: readonly AcceptanceCriterion[];
  readonly defaultSeverity: EvidenceSeverity;
  readonly id: string;
  readonly severityReason: string;
  readonly title: string;
}

export interface AcceptanceLedger {
  readonly groups: readonly AcceptanceGroup[];
  readonly profileVersion: string;
  readonly source: string;
}

export interface ReleaseEnvironment {
  readonly capabilities: Readonly<Record<string, string>>;
  readonly id: string;
}

export interface ReleaseEvidenceRecord {
  readonly artifacts: readonly string[];
  readonly criteria: readonly string[];
  readonly environments: readonly string[];
  readonly id: string;
  readonly limitation: string;
  readonly measurements?: readonly {
    readonly comparison?: 'at-least' | 'at-most' | 'equal';
    readonly name: string;
    readonly threshold?: number;
    readonly unit: string;
    readonly value: number;
  }[];
  readonly method: {
    readonly description: string;
    readonly kind: 'automated' | 'inspection' | 'manual' | 'not-run' | 'user-study';
  };
  readonly observedAt?: string;
  readonly result: EvidenceResult;
  readonly reviewer?: string;
}

export interface ReleaseManifest {
  readonly candidate: {
    readonly commit: string;
    readonly label: string;
    readonly lockfile: { readonly path: string; readonly sha256: string };
    readonly runtime: { readonly node: string; readonly packageManager: string };
  };
  readonly environments: readonly ReleaseEnvironment[];
  readonly evidence: readonly ReleaseEvidenceRecord[];
  readonly profileVersion: string;
}

export interface ResolvedCriterion {
  readonly evidence: ReleaseEvidenceRecord;
  readonly group: AcceptanceGroup;
  readonly id: string;
  readonly requirement: string;
  readonly severity: EvidenceSeverity;
  readonly severityReason: string;
}

export interface ReleaseSummary {
  readonly advisoryGaps: readonly ResolvedCriterion[];
  readonly counts: Readonly<Record<EvidenceResult, number>>;
  readonly launchBlockers: readonly ResolvedCriterion[];
  readonly launchReady: boolean;
  readonly notApplicable: readonly ResolvedCriterion[];
  readonly resolved: ReadonlyMap<string, ResolvedCriterion>;
}

const RESULTS = new Set<EvidenceResult>(['blocked', 'failed', 'not-run', 'passed']);
const SEVERITIES = new Set<EvidenceSeverity>(['advisory', 'launch-blocking', 'not-applicable']);
const CRITERION_ID = /^TMO-[A-Z0-9]+-[0-9]{3}$/;
const EVIDENCE_ID = /^EV-[A-Z0-9-]+$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be non-empty.`);
}

function assertUnique(values: readonly string[], label: string): void {
  assert(new Set(values).size === values.length, `${label} must not contain duplicates.`);
}

export function flattenLedger(ledger: AcceptanceLedger): readonly {
  readonly criterion: AcceptanceCriterion;
  readonly group: AcceptanceGroup;
}[] {
  return ledger.groups.flatMap((group) =>
    group.criteria.map((criterion) => ({ criterion, group })),
  );
}

export function validateLedger(ledger: AcceptanceLedger): void {
  assert(ledger.profileVersion === '1.0.0', 'Ledger profileVersion must be 1.0.0.');
  assert(
    ledger.source === 'docs/07-acceptance-criteria-and-test-plan.md',
    'Ledger source must remain acceptance document 07.',
  );
  assert(ledger.groups.length > 0, 'Ledger groups are required.');

  const groupIds: string[] = [];
  const criterionIds: string[] = [];
  for (const group of ledger.groups) {
    assertNonEmpty(group.id, 'Group id');
    assertNonEmpty(group.title, `Group ${group.id} title`);
    assert(SEVERITIES.has(group.defaultSeverity), `Group ${group.id} has an invalid severity.`);
    assertNonEmpty(group.severityReason, `Group ${group.id} severity reason`);
    assert(group.criteria.length > 0, `Group ${group.id} must contain criteria.`);
    groupIds.push(group.id);

    for (const criterion of group.criteria) {
      assert(CRITERION_ID.test(criterion.id), `Invalid criterion id ${criterion.id}.`);
      assertNonEmpty(criterion.requirement, `Criterion ${criterion.id} requirement`);
      assert(criterion.paths.length > 0, `Criterion ${criterion.id} needs an applicable path.`);
      assertUnique(criterion.paths, `Criterion ${criterion.id} paths`);
      if (criterion.severity) {
        assert(
          SEVERITIES.has(criterion.severity),
          `Criterion ${criterion.id} has invalid severity.`,
        );
      }
      if (criterion.severity !== undefined && criterion.severity !== group.defaultSeverity) {
        assertNonEmpty(
          criterion.severityReason,
          `Criterion ${criterion.id} severity override reason`,
        );
      }
      criterionIds.push(criterion.id);
    }
  }
  assertUnique(groupIds, 'Ledger group ids');
  assertUnique(criterionIds, 'Ledger criterion ids');
}

function validateMeasurement(
  evidence: ReleaseEvidenceRecord,
  measurement: NonNullable<ReleaseEvidenceRecord['measurements']>[number],
): void {
  assertNonEmpty(measurement.name, `Evidence ${evidence.id} measurement name`);
  assertNonEmpty(measurement.unit, `Evidence ${evidence.id} measurement unit`);
  assert(Number.isFinite(measurement.value), `Evidence ${evidence.id} measurement must be finite.`);
  if (measurement.threshold === undefined) return;
  assert(
    Number.isFinite(measurement.threshold),
    `Evidence ${evidence.id} threshold must be finite.`,
  );
  assert(
    measurement.comparison !== undefined,
    `Evidence ${evidence.id} threshold needs comparison.`,
  );
  if (evidence.result !== 'passed') return;
  const satisfied =
    measurement.comparison === 'at-most'
      ? measurement.value <= measurement.threshold
      : measurement.comparison === 'at-least'
        ? measurement.value >= measurement.threshold
        : measurement.value === measurement.threshold;
  assert(
    satisfied,
    `Evidence ${evidence.id} claims pass but misses ${measurement.name} threshold.`,
  );
}

export function validateManifest(ledger: AcceptanceLedger, manifest: ReleaseManifest): void {
  validateLedger(ledger);
  assert(manifest.profileVersion === '1.0.0', 'Manifest profileVersion must be 1.0.0.');
  assertNonEmpty(manifest.candidate.label, 'Candidate label');
  assert(
    /^[a-f0-9]{40}$/.test(manifest.candidate.commit),
    'Candidate commit must be a full SHA-1.',
  );
  assert(manifest.candidate.lockfile.path === 'pnpm-lock.yaml', 'Candidate lockfile path changed.');
  assert(
    /^[a-f0-9]{64}$/.test(manifest.candidate.lockfile.sha256),
    'Candidate lockfile hash must be SHA-256.',
  );
  assertNonEmpty(manifest.candidate.runtime.node, 'Candidate Node version');
  assertNonEmpty(manifest.candidate.runtime.packageManager, 'Candidate package manager');

  const environmentIds = manifest.environments.map((environment) => environment.id);
  assertUnique(environmentIds, 'Environment ids');
  const knownEnvironments = new Set(environmentIds);
  const evidenceIds: string[] = [];
  const coveredCriteria: string[] = [];
  const ledgerCriteria = new Set(flattenLedger(ledger).map(({ criterion }) => criterion.id));

  for (const evidence of manifest.evidence) {
    assert(EVIDENCE_ID.test(evidence.id), `Invalid evidence id ${evidence.id}.`);
    assert(RESULTS.has(evidence.result), `Evidence ${evidence.id} has an invalid result.`);
    assert(evidence.criteria.length > 0, `Evidence ${evidence.id} needs at least one criterion.`);
    assertUnique(evidence.criteria, `Evidence ${evidence.id} criteria`);
    assertUnique(evidence.environments, `Evidence ${evidence.id} environments`);
    assertUnique(evidence.artifacts, `Evidence ${evidence.id} artifacts`);
    assertNonEmpty(evidence.method.description, `Evidence ${evidence.id} method description`);
    for (const criterionId of evidence.criteria) {
      assert(
        ledgerCriteria.has(criterionId),
        `Evidence ${evidence.id} cites unknown ${criterionId}.`,
      );
    }
    for (const environmentId of evidence.environments) {
      assert(
        knownEnvironments.has(environmentId),
        `Evidence ${evidence.id} cites unknown environment ${environmentId}.`,
      );
    }
    if (evidence.result === 'passed') {
      assert(evidence.method.kind !== 'not-run', `Evidence ${evidence.id} cannot pass as not-run.`);
      assert(
        evidence.environments.length > 0,
        `Passed evidence ${evidence.id} needs an environment.`,
      );
      assert(evidence.artifacts.length > 0, `Passed evidence ${evidence.id} needs an artifact.`);
      assertNonEmpty(evidence.reviewer, `Passed evidence ${evidence.id} reviewer`);
      assertNonEmpty(evidence.observedAt, `Passed evidence ${evidence.id} observation date`);
      assert(
        !Number.isNaN(Date.parse(evidence.observedAt)),
        `Evidence ${evidence.id} observation date is invalid.`,
      );
    } else {
      assertNonEmpty(evidence.limitation, `Evidence ${evidence.id} limitation`);
    }
    for (const measurement of evidence.measurements ?? []) {
      validateMeasurement(evidence, measurement);
    }
    evidenceIds.push(evidence.id);
    coveredCriteria.push(...evidence.criteria);
  }

  assertUnique(evidenceIds, 'Evidence ids');
  assertUnique(coveredCriteria, 'Criteria coverage');
  const missing = [...ledgerCriteria].filter(
    (criterionId) => !coveredCriteria.includes(criterionId),
  );
  assert(missing.length === 0, `Manifest does not record criteria: ${missing.join(', ')}.`);
}

export function summariseRelease(
  ledger: AcceptanceLedger,
  manifest: ReleaseManifest,
): ReleaseSummary {
  validateManifest(ledger, manifest);
  const evidenceByCriterion = new Map<string, ReleaseEvidenceRecord>();
  for (const evidence of manifest.evidence) {
    for (const criterionId of evidence.criteria) evidenceByCriterion.set(criterionId, evidence);
  }

  const resolved = new Map<string, ResolvedCriterion>();
  for (const { criterion, group } of flattenLedger(ledger)) {
    const evidence = evidenceByCriterion.get(criterion.id);
    assert(evidence, `Missing evidence for ${criterion.id}.`);
    resolved.set(criterion.id, {
      evidence,
      group,
      id: criterion.id,
      requirement: criterion.requirement,
      severity: criterion.severity ?? group.defaultSeverity,
      severityReason: criterion.severityReason ?? group.severityReason,
    });
  }

  const values = [...resolved.values()];
  const counts: Record<EvidenceResult, number> = {
    blocked: 0,
    failed: 0,
    'not-run': 0,
    passed: 0,
  };
  for (const item of values) counts[item.evidence.result] += 1;
  const launchBlockers = values.filter(
    (item) => item.severity === 'launch-blocking' && item.evidence.result !== 'passed',
  );
  const advisoryGaps = values.filter(
    (item) => item.severity === 'advisory' && item.evidence.result !== 'passed',
  );
  const notApplicable = values.filter((item) => item.severity === 'not-applicable');
  return {
    advisoryGaps,
    counts,
    launchBlockers,
    launchReady: launchBlockers.length === 0,
    notApplicable,
    resolved,
  };
}

function tableRows(items: readonly ResolvedCriterion[]): string {
  if (items.length === 0) return '| — | — | — |\n';
  return items
    .map(
      (item) =>
        `| ${item.id} | ${item.evidence.result} | ${item.requirement.replaceAll('|', '\\|')} |`,
    )
    .join('\n');
}

export function renderReleaseSummary(ledger: AcceptanceLedger, manifest: ReleaseManifest): string {
  const summary = summariseRelease(ledger, manifest);
  const decision = summary.launchReady ? 'READY' : 'NOT READY';
  const generatedNote =
    '<!-- Generated by scripts/verify-release-evidence.ts. Do not promote blocked or not-run evidence manually. -->';
  return `${generatedNote}
# Release evidence summary

- Candidate: \`${manifest.candidate.commit}\` (${manifest.candidate.label})
- Evidence profile: \`${manifest.profileVersion}\`
- Decision: **${decision}**
- Launch blockers: **${summary.launchBlockers.length}**

Only \`passed\` satisfies a launch-blocking criterion. This summary counts \`blocked\` and
\`not-run\` as unresolved evidence, never as success.

## Result counts

| Passed | Failed | Blocked | Not run |
| -----: | -----: | ------: | ------: |
| ${summary.counts.passed} | ${summary.counts.failed} | ${summary.counts.blocked} | ${summary.counts['not-run']} |

## Launch blockers

| Criterion | Result | Requirement |
| --------- | ------ | ----------- |
${tableRows(summary.launchBlockers)}

## Advisory gaps

| Criterion | Result | Requirement |
| --------- | ------ | ----------- |
${tableRows(summary.advisoryGaps)}

## Not-applicable criteria

| Criterion | Result | Requirement |
| --------- | ------ | ----------- |
${tableRows(summary.notApplicable)}

## Evidence records

| Record | Result | Criteria | Method |
| ------ | ------ | -------: | ------ |
${manifest.evidence.map((evidence) => `| ${evidence.id} | ${evidence.result} | ${evidence.criteria.length} | ${evidence.method.description.replaceAll('|', '\\|')} |`).join('\n')}
`;
}
