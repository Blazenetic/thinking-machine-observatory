import { useMemo, useState } from 'react';

import type { TraceAnnotation } from '@observatory/domain';
import {
  evaluateExperiment,
  findExperiment,
  GUIDED_EXPERIMENTS,
  isExperimentReflection,
  type ExperimentEvaluation,
  type ExperimentObservationSnapshot,
  type VersionedGuidedExperiment,
} from '@observatory/experiments';

interface LiveExperimentNotebookProps {
  readonly activeAnnotations: readonly TraceAnnotation[];
  readonly activeTraceTitle: string | null;
  readonly observations: ExperimentObservationSnapshot;
  readonly onAppend: (
    experiment: VersionedGuidedExperiment,
    reflection: string,
    status: ExperimentEvaluation['status'],
  ) => void;
}

export function LiveExperimentNotebook({
  activeAnnotations,
  activeTraceTitle,
  observations,
  onAppend,
}: LiveExperimentNotebookProps) {
  const [experimentId, setExperimentId] = useState(GUIDED_EXPERIMENTS[0]?.id ?? '');
  const [reflection, setReflection] = useState('');
  const experiment = findExperiment(experimentId) ?? GUIDED_EXPERIMENTS[0];
  const evaluation = useMemo(
    () => (experiment ? evaluateExperiment(experiment, observations) : null),
    [experiment, observations],
  );
  const reflections = activeAnnotations.filter((annotation) =>
    isExperimentReflection(annotation.note, experiment?.id),
  );

  return (
    <section aria-labelledby="live-experiment-notebook-title" className="trace-dock">
      <div className="trace-dock__heading">
        <div>
          <p className="eyebrow">Guided experiment notebook</p>
          <h3 id="live-experiment-notebook-title">Exportable, replay-reviewable reflections</h3>
        </div>
        <strong>{activeTraceTitle ?? 'Awaiting trace'}</strong>
      </div>
      <div className="live-experiment-layout">
        <label>
          Protocol
          <select
            onChange={(event) => setExperimentId(event.currentTarget.value)}
            value={experimentId}
          >
            {GUIDED_EXPERIMENTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · v{item.protocolVersion}
              </option>
            ))}
          </select>
        </label>
        <div className="experiment-result" data-status={evaluation?.status ?? 'blocked'}>
          <span>Measured outcome</span>
          <strong>{evaluation?.status ?? 'blocked'}</strong>
        </div>
      </div>
      {evaluation && (
        <ul className="live-experiment-predicates">
          {evaluation.results.map((result) => (
            <li data-status={result.status} key={result.description}>
              <strong>{result.status}</strong>
              <span>{result.description}</span>
              <code>{String(result.observed)}</code>
            </li>
          ))}
        </ul>
      )}
      <div className="experiment-reflection">
        <label htmlFor="live-experiment-reflection">Reflection · append-only annotation</label>
        <textarea
          id="live-experiment-reflection"
          onChange={(event) => setReflection(event.currentTarget.value)}
          placeholder="Describe what the measured outcome supports and what it does not prove."
          rows={3}
          value={reflection}
        />
        <button
          className="secondary-button"
          disabled={
            !activeTraceTitle || !experiment || !evaluation || reflection.trim().length === 0
          }
          onClick={() => {
            if (!experiment || !evaluation) return;
            onAppend(experiment, reflection, evaluation.status);
            setReflection('');
          }}
          type="button"
        >
          Append to selected trace
        </button>
        {reflections.length > 0 && (
          <ol>
            {reflections.map((annotation) => (
              <li key={annotation.id}>{annotation.note}</li>
            ))}
          </ol>
        )}
      </div>
      <p className="instrument-note">
        Completion comes from the predicates above, never from this save button. The annotation
        travels with ancestry export and the transactional local notebook.
      </p>
    </section>
  );
}
