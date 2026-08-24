import { GUIDED_EXPERIMENTS } from '@observatory/experiments';

import { EvidenceBadge } from './EvidenceBadge';

interface GuidedLaboratoryProps {
  readonly onLoadRunnerUp: () => void;
}

export function GuidedLaboratory({ onLoadRunnerUp }: GuidedLaboratoryProps) {
  return (
    <section aria-labelledby="laboratory-title" className="laboratory instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Guided laboratory</p>
          <h2 id="laboratory-title">Eight controlled experiments</h2>
          <p>Begin with a question, change one main variable and record what the trace supports.</p>
        </div>
        <span className="experiment-count">08 protocols</span>
      </div>
      <div className="experiment-list">
        {GUIDED_EXPERIMENTS.map((experiment, index) => (
          <details className="experiment-card" key={experiment.id} open={index === 4}>
            <summary>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{experiment.title}</strong>
              <small>
                {experiment.evidenceClasses.map((item) => item[0]?.toUpperCase()).join(' · ')}
              </small>
            </summary>
            <div className="experiment-card__body">
              <p className="experiment-question">{experiment.question}</p>
              <p>{experiment.action}</p>
              <div className="experiment-observe">
                <span>Observe</span>
                <ul>
                  {experiment.observe.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="experiment-evidence">
                {experiment.evidenceClasses.map((evidenceClass) => (
                  <EvidenceBadge compact evidenceClass={evidenceClass} key={evidenceClass} />
                ))}
                <p>{experiment.integrityNote}</p>
              </div>
              <p className="experiment-limitation">
                <strong>What this does not prove:</strong> {experiment.limitation}
              </p>
              {experiment.id === 'force-runner-up' && (
                <button className="secondary-button" onClick={onLoadRunnerUp} type="button">
                  Run this intervention
                </button>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
