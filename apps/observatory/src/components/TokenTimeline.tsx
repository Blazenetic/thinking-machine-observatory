import type { ExperimentTrace } from '@observatory/domain';

import { EvidenceBadge } from './EvidenceBadge';

interface TokenTimelineProps {
  readonly trace: ExperimentTrace;
}

function visibleToken(text: string): string {
  return text.replaceAll(' ', '·').replaceAll('\n', '↵');
}

export function TokenTimeline({ trace }: TokenTimelineProps) {
  const selection = trace.steps.at(-1)?.sampler.selection;
  return (
    <section aria-labelledby="timeline-title" className="timeline instrument-frame">
      <div className="instrument-heading instrument-heading--compact">
        <div>
          <p className="eyebrow">Token specimen tray</p>
          <h2 id="timeline-title">Prompt boundary</h2>
        </div>
        <EvidenceBadge compact evidenceClass="derived" />
      </div>
      <ol className="token-tray" aria-label="Illustrative prompt tokens and selected continuation">
        {trace.promptTokens.map((token) => (
          <li className="token-specimen" key={`${token.position}-${token.tokenId}`}>
            <span className="token-specimen__position">
              {String(token.position).padStart(2, '0')}
            </span>
            <span className="token-specimen__text">{visibleToken(token.text)}</span>
            <span className="token-specimen__id">id {token.tokenId}</span>
          </li>
        ))}
        <li className="token-specimen token-specimen--prediction">
          <span className="token-specimen__position">
            {String(trace.promptTokens.length).padStart(2, '0')}
          </span>
          <span className="token-specimen__text">
            {selection ? visibleToken(selection.text) : '?'}
          </span>
          <span className="token-specimen__id">
            {selection ? `id ${selection.tokenId}` : 'pre-selection'}
          </span>
        </li>
      </ol>
      <p className="instrument-note">
        Boundaries in this teaching fixture resemble GPT-2 tokens but are illustrative until the
        pinned tokenizer is loaded.
      </p>
    </section>
  );
}
