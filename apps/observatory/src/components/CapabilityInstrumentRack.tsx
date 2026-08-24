import type { InstrumentCapability, InstrumentCapabilityId } from '@observatory/domain';

import { EvidenceBadge } from './EvidenceBadge';

interface CapabilityInstrumentRackProps {
  readonly capabilities: readonly InstrumentCapability[];
}

const INSTRUMENTS: readonly {
  readonly description: string;
  readonly id: Exclude<InstrumentCapabilityId, 'token-specimens'>;
  readonly limitation: string;
  readonly title: string;
}[] = [
  {
    description: 'Selected layer and token coordinates with bounded numeric summaries.',
    id: 'hidden-states',
    limitation: 'Final logits cannot reconstruct hidden-state coordinates.',
    title: 'Layer telescope',
  },
  {
    description: 'Verified head, query and key rows with causal-mask checks.',
    id: 'attention',
    limitation: 'Attention weight is not a complete causal explanation or importance score.',
    title: 'Attention interferometer',
  },
  {
    description: 'A named layerwise vocabulary probe with explicit normalisation.',
    id: 'logit-lens',
    limitation: 'A probe is not a direct readout of a thought, belief or intention.',
    title: 'Logit-lens probe',
  },
  {
    description: 'Distances over identified vectors and a separately labelled 2D layout.',
    id: 'semantic-projection',
    limitation: 'Two-dimensional proximity is lossy and is never causal evidence.',
    title: 'Semantic chart',
  },
] as const;

function limits(capability: InstrumentCapability | undefined): string {
  if (!capability) return 'No session declaration';
  const entries = Object.entries(capability.limits);
  return entries.length > 0
    ? entries.map(([name, value]) => `${name} ${value.toLocaleString()}`).join(' · ')
    : 'No allocation authorised';
}

export function CapabilityInstrumentRack({ capabilities }: CapabilityInstrumentRackProps) {
  return (
    <section aria-labelledby="capability-instruments-title" className="capability-instruments">
      <div className="trace-dock__heading">
        <div>
          <p className="eyebrow">Capability-gated instrument bay</p>
          <h3 id="capability-instruments-title">Absence is an explicit result</h3>
        </div>
        <strong>{capabilities.length > 0 ? 'Session declared' : 'No active session'}</strong>
      </div>
      <div className="capability-instrument-grid">
        {INSTRUMENTS.map((instrument) => {
          const capability = capabilities.find((item) => item.id === instrument.id);
          const status = capability?.status ?? 'unavailable';
          return (
            <article data-status={status} key={instrument.id}>
              <div>
                <EvidenceBadge
                  compact
                  evidenceClass={
                    capability?.evidenceClass ??
                    (instrument.id === 'logit-lens'
                      ? 'probed'
                      : instrument.id === 'semantic-projection'
                        ? 'projected'
                        : 'measured')
                  }
                />
                <strong className="capability-status">{status}</strong>
              </div>
              <h4>{instrument.title}</h4>
              <p>{instrument.description}</p>
              <dl>
                <div>
                  <dt>Profile</dt>
                  <dd>{capability?.profileId ?? 'none accepted'}</dd>
                </div>
                <div>
                  <dt>Method</dt>
                  <dd>{capability?.methodVersion ?? 'not declared'}</dd>
                </div>
                <div>
                  <dt>Limits</dt>
                  <dd>{limits(capability)}</dd>
                </div>
              </dl>
              <p className="instrument-unavailable-reason">
                {capability?.reason ?? 'Load a worker session to receive an explicit declaration.'}
              </p>
              <p className="instrument-limitation">{instrument.limitation}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
