import type { GenerationStep } from '@observatory/domain';
import { explainSelection } from '@observatory/instruments';

import { EvidenceBadge } from './EvidenceBadge';

interface SelectionExplanationProps {
  readonly step: GenerationStep;
}

export function SelectionExplanation({ step }: SelectionExplanationProps) {
  const explanation = explainSelection(step);
  const selected = step.sampler.selection;
  const candidate = step.sampler.candidates.find((item) => item.tokenId === selected.tokenId);

  return (
    <section aria-labelledby="selection-title" className="selection-explanation instrument-frame">
      <div className="instrument-heading instrument-heading--compact">
        <div>
          <p className="eyebrow">Mechanical account</p>
          <h2 id="selection-title">Why was “{selected.text.trim()}” selected?</h2>
        </div>
        <EvidenceBadge evidenceClass={selected.mode === 'forced' ? 'interventional' : 'derived'} />
      </div>
      <ol className="selection-path">
        <li>
          <span>01</span>
          <p>
            Original rank <strong>{candidate?.rawRank}</strong>, logit{' '}
            <strong>{candidate?.logit.toFixed(3)}</strong>.
          </p>
        </li>
        <li>
          <span>02</span>
          <p>{explanation.transformedLogit}</p>
        </li>
        <li>
          <span>03</span>
          <p>{explanation.filterPath}</p>
        </li>
        <li>
          <span>04</span>
          <p>
            {explanation.draw} Interval {explanation.interval}.
          </p>
        </li>
        <li>
          <span>05</span>
          <p>{explanation.selectionRule}</p>
        </li>
      </ol>
      <div className="explanation-boundary">
        <p>
          <strong>Explains:</strong> the recorded sampler path from fixture score to selected token.
        </p>
        <p>
          <strong>Does not explain:</strong> model intent, belief, consciousness or a complete
          causal account of generation.
        </p>
      </div>
    </section>
  );
}
