import report from '../model-tools/verification/instrument-capability-report.json' with { type: 'json' };

const EXPECTED_CAPABILITIES = [
  'token-specimens',
  'hidden-states',
  'attention',
  'logit-lens',
  'semantic-projection',
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Instrument capability report failed: ${message}`);
}

assert(report.schemaVersion === '1.0.0', 'unexpected schema version');
assert(report.activeExport.observedAdapterOutputs.length === 1, 'output inventory widened');
assert(
  report.activeExport.observedAdapterOutputs[0] === 'logits',
  'logits must be the sole output',
);
assert(report.acceptedPrimaryOutput.status === 'accepted', 'final logits lost acceptance');
assert(
  report.acceptedPrimaryOutput.profileId === 'distilgpt2-wasm-fp32-v1',
  'final-logit profile changed',
);
assert(report.capabilities.length === EXPECTED_CAPABILITIES.length, 'capability count changed');

for (const id of EXPECTED_CAPABILITIES) {
  const capability = report.capabilities.find((item) => item.id === id);
  assert(capability, `missing ${id}`);
  if (id === 'token-specimens') {
    assert(capability.status === 'verified', 'token specimens are not verified');
    assert(capability.profileId !== null, 'token specimens lack a profile');
  } else {
    assert(capability.status === 'unavailable', `${id} was enabled without accepted evidence`);
    assert(capability.profileId === null, `${id} has an unaccepted profile`);
    assert(capability.limits.maxCapturedBytes === 0, `${id} permits an allocation`);
  }
}

assert(
  report.candidateSecondaryCaptureBudget.maxLayers === 2 &&
    report.candidateSecondaryCaptureBudget.maxHeads === 2 &&
    report.candidateSecondaryCaptureBudget.maxTokenPositions === 16 &&
    report.candidateSecondaryCaptureBudget.maxCapturedBytes === 1_048_576,
  'candidate capture budget changed',
);
assert(
  report.decisions.secondaryTensorSchema.includes('schema 1.3'),
  'secondary tensor schema decision is missing',
);
assert(
  report.secondaryOutputAdmission.status === 'rejected-for-current-export',
  'current export must not admit secondary outputs',
);

console.log(
  `Verified ${report.capabilities.length} instrument declarations: token specimens accepted; four secondary instruments unavailable.`,
);
