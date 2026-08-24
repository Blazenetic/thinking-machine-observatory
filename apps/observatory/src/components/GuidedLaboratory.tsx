import { useState } from 'react';

import type { TraceAnnotation } from '@observatory/domain';
import { GUIDED_EXPERIMENTS } from '@observatory/experiments';
import {
  evaluateExperiment,
  isExperimentReflection,
  type ExperimentEvaluation,
  type ExperimentObservationSnapshot,
  type VersionedGuidedExperiment,
} from '@observatory/experiments';

import { EvidenceBadge } from './EvidenceBadge';

interface GuidedLaboratoryProps {
  readonly activeAnnotations: readonly TraceAnnotation[];
  readonly activeTraceTitle: string;
  readonly observations: ExperimentObservationSnapshot;
  readonly onAddReflection: (
    experiment: VersionedGuidedExperiment,
    reflection: string,
    status: ExperimentEvaluation['status'],
  ) => void;
  readonly onLoadRunnerUp: () => void;
}

export function GuidedLaboratory({
  activeAnnotations,
  activeTraceTitle,
  observations,
  onAddReflection,
  onLoadRunnerUp,
}: GuidedLaboratoryProps) {
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [openExperiments, setOpenExperiments] = useState<ReadonlySet<string>>(
    () => new Set(['force-runner-up']),
  );

  return (
    <section aria-labelledby="laboratory-title" className="laboratory instrument-frame">
      <div className="instrument-heading">
        <div>
          <p className="eyebrow">Guided laboratory</p>
          <h2 id="laboratory-title">Eight controlled experiments</h2>
          <p>
            Begin with a question, change one main variable and let trace predicates decide what was
            observed. Reflections append to {activeTraceTitle}.
          </p>
        </div>
        <span className="experiment-count">08 protocols</span>
      </div>
      <div className="experiment-list">
        {GUIDED_EXPERIMENTS.map((experiment, index) => {
          const evaluation = evaluateExperiment(experiment, observations);
          const reflections = activeAnnotations.filter((annotation) =>
            isExperimentReflection(annotation.note, experiment.id),
          );
          const draft = drafts[experiment.id] ?? '';
          return (
            <details
              className="experiment-card"
              data-status={evaluation.status}
              key={experiment.id}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setOpenExperiments((current) => {
                  if (current.has(experiment.id) === isOpen) return current;
                  const next = new Set(current);
                  if (isOpen) next.add(experiment.id);
                  else next.delete(experiment.id);
                  return next;
                });
              }}
              open={openExperiments.has(experiment.id)}
            >
              <summary>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{experiment.title}</strong>
                <small>
                  v{experiment.protocolVersion} · {evaluation.status}
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
                <div className="experiment-predicates" aria-label="Observation predicates">
                  <span>Evidence check</span>
                  <ul>
                    {evaluation.results.map((result) => (
                      <li data-status={result.status} key={result.description}>
                        <strong>{result.status}</strong>
                        <span>{result.description}</span>
                        <code>{String(result.observed)}</code>
                      </li>
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
                <div className="experiment-reflection">
                  <label htmlFor={`reflection-${experiment.id}`}>
                    Reflection · append-only trace annotation
                  </label>
                  <textarea
                    id={`reflection-${experiment.id}`}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDrafts((current) => ({
                        ...current,
                        [experiment.id]: value,
                      }));
                    }}
                    placeholder="Record what the evidence supports and what remains uncertain."
                    rows={3}
                    value={draft}
                  />
                  <button
                    className="text-button"
                    disabled={draft.trim().length === 0}
                    id={`append-reflection-${experiment.id}`}
                    onClick={() => {
                      onAddReflection(experiment, draft, evaluation.status);
                      setDrafts((current) => ({ ...current, [experiment.id]: '' }));
                    }}
                    type="button"
                  >
                    Append reflection to trace
                  </button>
                  {reflections.length > 0 && (
                    <ol>
                      {reflections.map((annotation) => (
                        <li key={annotation.id}>{annotation.note}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
