import type {
  BranchComparison,
  CandidateRecord,
  ExperimentTrace,
  GenerationStep,
  SelectionRecord,
  TokenSpecimen,
} from '@observatory/domain';

export const TOKEN_FRAGMENT_BYTE_METHOD = 'utf8-text-encoder-v1' as const;

export type TokenSpecimenOrigin = 'generated' | 'pending' | 'prompt';

export interface TokenSelectionSpecimen {
  readonly text: string;
  readonly tokenId: number;
}

export interface TokenSpecimenRow {
  readonly byteDecimal: string;
  readonly byteHex: string;
  readonly byteValues: readonly number[];
  readonly codePoints: string;
  readonly fragmentLabel: string;
  readonly origin: TokenSpecimenOrigin;
  readonly position: number;
  readonly rawText: string;
  readonly recordedBytesMatch: boolean | null;
  readonly tokenId: number;
}

export function utf8FragmentBytes(text: string): readonly number[] {
  return [...new TextEncoder().encode(text)];
}

function visibleCharacter(character: string): string {
  if (character === ' ') return '␠';
  if (character === '\n') return '↵';
  if (character === '\r') return '␍';
  if (character === '\t') return '⇥';
  const codePoint = character.codePointAt(0) ?? 0;
  if (codePoint < 32 || codePoint === 127) return `\\u{${codePoint.toString(16).padStart(4, '0')}}`;
  return character;
}

export function visibleTokenFragment(text: string): string {
  if (text.length === 0) return '∅ empty fragment';
  return [...text].map(visibleCharacter).join('');
}

function codePointLabel(text: string): string {
  if (text.length === 0) return 'none';
  return [...text]
    .map(
      (character) =>
        `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
    )
    .join(' ');
}

function specimenRow(
  specimen: TokenSelectionSpecimen,
  origin: TokenSpecimenOrigin,
  position: number,
  recordedBytes: readonly number[] | null,
): TokenSpecimenRow {
  const byteValues = utf8FragmentBytes(specimen.text);
  return {
    byteDecimal: byteValues.join(' '),
    byteHex: byteValues.map((value) => value.toString(16).toUpperCase().padStart(2, '0')).join(' '),
    byteValues,
    codePoints: codePointLabel(specimen.text),
    fragmentLabel: visibleTokenFragment(specimen.text),
    origin,
    position,
    rawText: specimen.text,
    recordedBytesMatch:
      recordedBytes === null
        ? null
        : byteValues.length === recordedBytes.length &&
          byteValues.every((value, index) => value === recordedBytes[index]),
    tokenId: specimen.tokenId,
  };
}

export function buildTokenSpecimenRows(input: {
  readonly generated: readonly TokenSelectionSpecimen[];
  readonly pending?: TokenSelectionSpecimen | null;
  readonly promptTokens: readonly TokenSpecimen[];
}): readonly TokenSpecimenRow[] {
  const promptRows = input.promptTokens.map((token) =>
    specimenRow(token, 'prompt', token.position, token.byteValues),
  );
  const generatedRows = input.generated.map((selection, index) =>
    specimenRow(selection, 'generated', input.promptTokens.length + index, null),
  );
  const pendingRow = input.pending
    ? [
        specimenRow(
          input.pending,
          'pending',
          input.promptTokens.length + input.generated.length,
          null,
        ),
      ]
    : [];
  return Object.freeze([...promptRows, ...generatedRows, ...pendingRow]);
}

export function tokenSpecimenTextAlternative(rows: readonly TokenSpecimenRow[]): string {
  return [
    'position\torigin\ttoken_id\tdecoded_fragment\tutf8_hex\tutf8_decimal\tcode_points\trecorded_bytes_match',
    ...rows.map((row) =>
      [
        row.position,
        row.origin,
        row.tokenId,
        JSON.stringify(row.rawText),
        row.byteHex,
        row.byteDecimal,
        row.codePoints,
        row.recordedBytesMatch === null ? 'not-recorded' : String(row.recordedBytesMatch),
      ].join('\t'),
    ),
  ].join('\n');
}

export interface ProbabilityRow {
  readonly cumulativeProbabilityBeforeTopP: number | null;
  readonly eliminationReason: CandidateRecord['eliminationReason'];
  readonly finalProbability: number;
  readonly interval: CandidateRecord['interval'];
  readonly logit: number;
  readonly probabilityBeforeTopP: number;
  readonly rank: number;
  readonly selected: boolean;
  readonly text: string;
  readonly tokenId: number;
}

export function buildProbabilityRows(step: GenerationStep): readonly ProbabilityRow[] {
  return step.sampler.candidates.map((candidate) => ({
    cumulativeProbabilityBeforeTopP: candidate.cumulativeProbabilityBeforeTopP,
    eliminationReason: candidate.eliminationReason,
    finalProbability: candidate.finalProbability,
    interval: candidate.interval,
    logit: candidate.logit,
    probabilityBeforeTopP: candidate.probabilityBeforeTopP,
    rank: candidate.rawRank,
    selected: candidate.tokenId === step.sampler.selection.tokenId,
    text: candidate.text,
    tokenId: candidate.tokenId,
  }));
}

function probabilityMap(candidates: readonly CandidateRecord[]): ReadonlyMap<number, number> {
  return new Map(candidates.map((candidate) => [candidate.tokenId, candidate.finalProbability]));
}

function assertDistribution(probabilities: ReadonlyMap<number, number>): void {
  const mass = [...probabilities.values()].reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(mass - 1) > 1e-9) {
    throw new Error(`Distribution mass must sum to one; received ${mass}.`);
  }
}

function klDivergenceBits(
  source: ReadonlyMap<number, number>,
  midpoint: ReadonlyMap<number, number>,
): number {
  let divergence = 0;
  for (const [tokenId, probability] of source) {
    if (probability <= 0) continue;
    const middleProbability = midpoint.get(tokenId) ?? 0;
    divergence += probability * Math.log2(probability / middleProbability);
  }
  return divergence;
}

/** Symmetric Jensen–Shannon divergence over the union of token IDs, measured in bits. */
export function jensenShannonDivergenceBits(
  leftCandidates: readonly CandidateRecord[],
  rightCandidates: readonly CandidateRecord[],
): number {
  const left = probabilityMap(leftCandidates);
  const right = probabilityMap(rightCandidates);
  assertDistribution(left);
  assertDistribution(right);
  const tokenIds = new Set([...left.keys(), ...right.keys()]);
  const midpoint = new Map<number, number>();
  for (const tokenId of tokenIds) {
    midpoint.set(tokenId, ((left.get(tokenId) ?? 0) + (right.get(tokenId) ?? 0)) / 2);
  }
  return (klDivergenceBits(left, midpoint) + klDivergenceBits(right, midpoint)) / 2;
}

function sameModel(left: ExperimentTrace, right: ExperimentTrace): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.model.id === right.model.id &&
    left.model.revision === right.model.revision &&
    left.model.dtype === right.model.dtype &&
    left.tokenizer.id === right.tokenizer.id &&
    left.tokenizer.revision === right.tokenizer.revision &&
    left.calculationVersions.sampler === right.calculationVersions.sampler
  );
}

function findFirstSelectionDivergence(
  leftSteps: readonly GenerationStep[],
  rightSteps: readonly GenerationStep[],
): number | null {
  const length = Math.min(leftSteps.length, rightSteps.length);
  for (let index = 0; index < length; index += 1) {
    if (
      leftSteps[index]?.sampler.selection.tokenId !== rightSteps[index]?.sampler.selection.tokenId
    ) {
      return index;
    }
  }
  return leftSteps.length === rightSteps.length ? null : length;
}

export function compareBranches(left: ExperimentTrace, right: ExperimentTrace): BranchComparison {
  if (!sameModel(left, right)) {
    return {
      compatible: false,
      entropyDeltaBits: null,
      firstDivergenceStep: null,
      jensenShannonBits: null,
      reason: 'Model, tokenizer, schema or sampler calculation versions differ.',
      selectedTokenChanged: false,
    };
  }

  const leftStep = left.steps.at(-1);
  const rightStep = right.steps.at(-1);
  if (!leftStep || !rightStep) {
    return {
      compatible: true,
      entropyDeltaBits: null,
      firstDivergenceStep: findFirstSelectionDivergence(left.steps, right.steps),
      jensenShannonBits: null,
      reason: 'Both branches need a committed prediction before distribution comparison.',
      selectedTokenChanged: false,
    };
  }

  return {
    compatible: true,
    entropyDeltaBits: rightStep.sampler.entropyBits - leftStep.sampler.entropyBits,
    firstDivergenceStep: findFirstSelectionDivergence(left.steps, right.steps),
    jensenShannonBits: jensenShannonDivergenceBits(
      leftStep.sampler.candidates,
      rightStep.sampler.candidates,
    ),
    reason: null,
    selectedTokenChanged:
      leftStep.sampler.selection.tokenId !== rightStep.sampler.selection.tokenId,
  };
}

export interface SelectionExplanation {
  readonly draw: string;
  readonly filterPath: string;
  readonly interval: string;
  readonly selectionRule: string;
  readonly transformedLogit: string;
}

function formatInterval(selection: SelectionRecord): string {
  if (!selection.interval) return 'No sampling interval; a manual override selected this token.';
  return `[${selection.interval[0].toFixed(4)}, ${selection.interval[1].toFixed(4)})`;
}

export function explainSelection(step: GenerationStep): SelectionExplanation {
  const selection = step.sampler.selection;
  const candidate = step.sampler.candidates.find((item) => item.tokenId === selection.tokenId);
  if (!candidate) throw new Error('Selected token is absent from the candidate record.');

  const retained = candidate.eliminationReason === null;
  return {
    draw: selection.draw
      ? `${selection.draw.value.toFixed(6)} from ${selection.draw.algorithm}`
      : 'No pseudo-random draw was used.',
    filterPath: retained
      ? `Retained by top-k and top-p; renormalised probability ${(candidate.finalProbability * 100).toFixed(2)}%.`
      : `Removed by ${candidate.eliminationReason}; selected only by explicit override.`,
    interval: formatInterval(selection),
    selectionRule:
      selection.mode === 'sampled'
        ? 'The seeded draw fell inside this candidate interval.'
        : selection.mode === 'greedy'
          ? 'Greedy mode selected the highest surviving score.'
          : 'A recorded manual intervention forced this candidate.',
    transformedLogit:
      candidate.temperatureScaledLogit === null
        ? 'Not available after suppression.'
        : step.sampler.config.mode === 'greedy'
          ? `${candidate.logit.toFixed(3)} raw logit; greedy mode does not apply temperature.`
          : `${candidate.logit.toFixed(3)} ÷ ${step.sampler.config.temperature.toFixed(2)} = ${candidate.temperatureScaledLogit.toFixed(3)}`,
  };
}
