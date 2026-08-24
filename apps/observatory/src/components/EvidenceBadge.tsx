import { EVIDENCE_CLASSES, type EvidenceClass } from '@observatory/domain';

interface EvidenceBadgeProps {
  readonly evidenceClass: EvidenceClass;
  readonly compact?: boolean;
}

export function EvidenceBadge({ evidenceClass, compact = false }: EvidenceBadgeProps) {
  const evidence = EVIDENCE_CLASSES[evidenceClass];
  return (
    <span
      className={`evidence-badge evidence-badge--${evidenceClass}`}
      title={`${evidence.label}: ${evidence.description}`}
    >
      <span aria-hidden="true" className="evidence-badge__mark">
        {evidence.abbreviation}
      </span>
      {!compact && <span>{evidence.label}</span>}
      <span className="sr-only">: {evidence.description}</span>
    </span>
  );
}

export function EvidenceLegend() {
  return (
    <details className="evidence-legend">
      <summary>Evidence key</summary>
      <div className="evidence-legend__items">
        {(Object.keys(EVIDENCE_CLASSES) as EvidenceClass[]).map((evidenceClass) => (
          <EvidenceBadge evidenceClass={evidenceClass} key={evidenceClass} />
        ))}
      </div>
    </details>
  );
}
