import { useMemo, useState } from 'react';

import type { ExperimentTrace, SamplerConfig } from '@observatory/domain';
import {
  formatExperimentReflection,
  type ExperimentEvaluation,
  type ExperimentObservationSnapshot,
  type VersionedGuidedExperiment,
} from '@observatory/experiments';
import { SamplerConfigurationError } from '@observatory/sampler';
import { addAnnotation } from '@observatory/trace-schema';

import { BranchChamber } from './components/BranchChamber';
import { CalibrationRail } from './components/CalibrationRail';
import { EvidenceLegend } from './components/EvidenceBadge';
import { GuidedLaboratory } from './components/GuidedLaboratory';
import { LiveModelPanel } from './components/LiveModelPanel';
import { ProbabilitySpectrometer } from './components/ProbabilitySpectrometer';
import { SelectionExplanation } from './components/SelectionExplanation';
import { TokenTimeline } from './components/TokenTimeline';
import {
  createBaselineTrace,
  createDemoBranch,
  createDemoStep,
  DEMO_CANDIDATES,
  DEMO_PROMPT,
  WORKBENCH_CONFIG,
} from './data/demo';
import { downloadTrace } from './utils/traceFiles';

function branchTitle(config: SamplerConfig, forcedTokenId: number | null, suppressedCount: number) {
  if (forcedTokenId !== null) {
    const token = DEMO_CANDIDATES.find(
      (candidate) => candidate.tokenId === forcedTokenId,
    )?.text.trim();
    return `Forced “${token ?? forcedTokenId}”`;
  }
  if (suppressedCount > 0)
    return `Suppressed ${suppressedCount} candidate${suppressedCount === 1 ? '' : 's'}`;
  if (config.mode === 'greedy') return 'Greedy counterfactual';
  return `Seed ${config.seed}`;
}

export function App() {
  const [baseline, setBaseline] = useState<ExperimentTrace>(() => createBaselineTrace());
  const [branches, setBranches] = useState<readonly ExperimentTrace[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState(baseline.traceId);
  const [config, setConfig] = useState<SamplerConfig>(WORKBENCH_CONFIG);
  const [forcedTokenId, setForcedTokenId] = useState<number | null>(null);
  const [suppressedTokenIds, setSuppressedTokenIds] = useState<readonly number[]>([]);
  const [announcement, setAnnouncement] = useState(
    'Teaching fixture loaded. Paused before selection.',
  );

  const interventions = useMemo(
    () => ({ forcedTokenId, suppressedTokenIds }),
    [forcedTokenId, suppressedTokenIds],
  );
  const previewStep = useMemo(() => createDemoStep(config, interventions), [config, interventions]);
  const previewTrace = useMemo(
    () => ({ ...baseline, steps: [previewStep], title: 'Workbench preview' }),
    [baseline, previewStep],
  );

  const forceToken = (tokenId: number | null) => {
    setForcedTokenId(tokenId);
    if (tokenId !== null) {
      setSuppressedTokenIds((current) => current.filter((item) => item !== tokenId));
      const token = DEMO_CANDIDATES.find((candidate) => candidate.tokenId === tokenId)?.text.trim();
      setAnnouncement(
        `Preview now forces ${token ?? `token ${tokenId}`}. Commit to create a branch.`,
      );
    } else {
      setAnnouncement('Manual force removed from the reversible preview.');
    }
  };

  const toggleSuppression = (tokenId: number) => {
    setForcedTokenId((current) => (current === tokenId ? null : current));
    setSuppressedTokenIds((current) => {
      if (current.includes(tokenId)) {
        setAnnouncement('Candidate restored to the preview distribution.');
        return current.filter((item) => item !== tokenId);
      }
      if (current.length >= DEMO_CANDIDATES.length - 1) {
        setAnnouncement('At least one candidate must remain; suppression was not applied.');
        return current;
      }
      setAnnouncement('Candidate suppressed before temperature and sampler filters.');
      return [...current, tokenId];
    });
  };

  const commit = (
    nextConfig = config,
    nextForcedTokenId = forcedTokenId,
    nextSuppressedTokenIds = suppressedTokenIds,
  ) => {
    try {
      const branchNumber = branches.length + 1;
      const branch = createDemoBranch(baseline, {
        branchNumber,
        config: nextConfig,
        interventions: {
          forcedTokenId: nextForcedTokenId,
          suppressedTokenIds: nextSuppressedTokenIds,
        },
        title: branchTitle(nextConfig, nextForcedTokenId, nextSuppressedTokenIds.length),
      });
      setBranches((current) => [...current, branch]);
      setSelectedTraceId(branch.traceId);
      setAnnouncement(
        `Branch ${branchNumber} committed. Selected token ${branch.steps[0]?.sampler.selection.text.trim()}. Baseline unchanged.`,
      );
    } catch (error) {
      setAnnouncement(
        error instanceof SamplerConfigurationError
          ? error.message
          : 'Branch could not be committed.',
      );
    }
  };

  const forceRunnerUp = () => {
    const runnerUp = DEMO_CANDIDATES[1];
    if (!runnerUp) return;
    setForcedTokenId(runnerUp.tokenId);
    setSuppressedTokenIds((current) => current.filter((item) => item !== runnerUp.tokenId));
    commit(
      config,
      runnerUp.tokenId,
      suppressedTokenIds.filter((item) => item !== runnerUp.tokenId),
    );
  };

  const resetWorkbench = () => {
    setConfig(WORKBENCH_CONFIG);
    setForcedTokenId(null);
    setSuppressedTokenIds([]);
    setAnnouncement(
      'Calibration returned to the default seeded preview. Existing branches remain.',
    );
  };

  const forcedToken =
    DEMO_CANDIDATES.find((candidate) => candidate.tokenId === forcedTokenId)?.text ?? null;
  const selectedTrace = branches.find((trace) => trace.traceId === selectedTraceId) ?? baseline;
  const experimentObservations = useMemo<ExperimentObservationSnapshot>(() => {
    const traces = [baseline, ...branches];
    const steps = traces.flatMap((trace) => trace.steps);
    return {
      attentionInterventions: 0,
      capabilities: {
        attention: 'unavailable',
        'hidden-states': 'unavailable',
        'logit-lens': 'unavailable',
        'semantic-projection': 'unavailable',
        'token-specimens': 'unverified',
      },
      distinctPrompts: new Set(traces.map((trace) => trace.prompt)).size,
      distinctSeeds: new Set(steps.map((step) => step.sampler.config.seed)).size,
      distinctTemperatures: new Set(steps.map((step) => step.sampler.config.temperature)).size,
      distinctTopP: new Set(steps.map((step) => step.sampler.config.topP)).size,
      forcedSelections: steps.filter((step) => step.sampler.selection.mode === 'forced').length,
      probeSweeps: 0,
      tokenSpecimens: selectedTrace.promptTokens.length,
      whitespaceBoundaries: selectedTrace.promptTokens.filter((token) => token.text.startsWith(' '))
        .length,
    };
  }, [baseline, branches, selectedTrace]);

  const addExperimentReflection = (
    experiment: VersionedGuidedExperiment,
    reflection: string,
    status: ExperimentEvaluation['status'],
  ) => {
    const note = formatExperimentReflection({
      experimentId: experiment.id,
      experimentVersion: experiment.protocolVersion,
      observationStatus: status,
      reflection,
    });
    const annotate = (trace: ExperimentTrace) =>
      addAnnotation(trace, {
        note,
        step: trace.steps.length > 0 ? trace.steps.length - 1 : null,
      });
    if (selectedTrace.traceId === baseline.traceId) {
      setBaseline(annotate);
    } else {
      setBranches((current) =>
        current.map((trace) => (trace.traceId === selectedTrace.traceId ? annotate(trace) : trace)),
      );
    }
    setAnnouncement(
      `Reflection appended to ${selectedTrace.title}; prior annotations are unchanged.`,
    );
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#observation-floor">
        Skip to observation floor
      </a>
      <header className="top-rail">
        <a className="wordmark" href="#top" id="top">
          <span className="wordmark__orb" aria-hidden="true" />
          <span>
            <strong>The Thinking Machine</strong>
            <small>Observatory / instrument 01</small>
          </span>
        </a>
        <div className="top-rail__status" aria-label="Current execution state">
          <span className="status-lamp status-lamp--amber">Illustrative demo</span>
          <span className="status-lamp status-lamp--cyan">Sampler exact</span>
          <span className="status-lamp">Pre-selection pause</span>
        </div>
        <EvidenceLegend />
      </header>

      <main>
        <section className="welcome-deck">
          <div className="welcome-deck__index" aria-hidden="true">
            TMO / 001
          </div>
          <div className="welcome-deck__copy">
            <p className="eyebrow">An interactive laboratory for next-token prediction</p>
            <h1>
              Observe. <span>Intervene.</span> Compare.
            </h1>
            <p className="lede">
              Pause before a token is selected, inspect every sampler transform, branch the future
              and compare the result without pretending that measurement is mind-reading.
            </p>
          </div>
          <div className="integrity-plate">
            <span aria-hidden="true">∴</span>
            <div>
              <strong>Instrument boundary</strong>
              <p>
                The default score field is an illustrative teaching fixture. The sampler
                mathematics, seeded draw, filters, trace lineage and comparisons are exact within
                its declared 10-candidate universe.
              </p>
            </div>
          </div>
        </section>

        <section className="observation-floor" id="observation-floor" tabIndex={-1}>
          <div className="floor-heading">
            <div>
              <p className="eyebrow">Observation floor</p>
              <h2>Prediction position 04</h2>
            </div>
            <div className="floor-heading__readout">
              <span>Fixture</span>
              <strong>10 / 10 candidates</strong>
            </div>
          </div>

          <section className="prompt-bench instrument-frame" aria-labelledby="prompt-title">
            <div>
              <p className="eyebrow">Prompt bench · fixture locked</p>
              <h2 id="prompt-title">Input text</h2>
            </div>
            <textarea
              aria-describedby="prompt-note"
              aria-label="Illustrative prompt"
              readOnly
              rows={2}
              value={DEMO_PROMPT}
            />
            <p id="prompt-note">
              The first vertical slice locks the prompt so the illustrative candidate universe is
              never mistaken for output from edited text.
            </p>
          </section>

          <TokenTimeline trace={previewTrace} />

          <div className="instrument-workbench">
            <ProbabilitySpectrometer
              forcedTokenId={forcedTokenId}
              onForce={forceToken}
              onToggleSuppression={toggleSuppression}
              step={previewStep}
              suppressedTokenIds={suppressedTokenIds}
            />
            <CalibrationRail
              branchCount={branches.length}
              config={config}
              forcedToken={forcedToken}
              onCommit={() => commit()}
              onConfigChange={setConfig}
              onForceRunnerUp={forceRunnerUp}
              onReset={resetWorkbench}
              selectedToken={previewStep.sampler.selection.text}
              suppressedCount={suppressedTokenIds.length}
            />
          </div>

          <SelectionExplanation step={previewStep} />

          <BranchChamber
            baseline={baseline}
            branches={branches}
            onExport={downloadTrace}
            onSelect={setSelectedTraceId}
            selectedTraceId={selectedTraceId}
          />
        </section>

        <GuidedLaboratory
          activeAnnotations={selectedTrace.annotations}
          activeTraceTitle={selectedTrace.title}
          observations={experimentObservations}
          onAddReflection={addExperimentReflection}
          onLoadRunnerUp={forceRunnerUp}
        />
        <LiveModelPanel prompt={DEMO_PROMPT} />
      </main>

      <footer>
        <p>
          Local-first. No account. No prompt telemetry. Scientific claims stop where evidence stops.
        </p>
        <a href="https://github.com/Blazenetic/thinking-machine-observatory">
          Source and instrument manual
        </a>
      </footer>

      <div aria-live="polite" className="status-announcer" role="status">
        {announcement}
      </div>
    </div>
  );
}
