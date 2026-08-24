# Two-minute first-use learner protocol

- Protocol: `first-branch-v1`
- Target: five representative learners where practical
- Product path: illustrative teaching fixture only
- Data boundary: no analytics, prompt telemetry or unnecessary personal details

## Consent and participant code

Explain that this is a short usability study, participation is voluntary, task notes may be retained
in synthesised form and the participant may stop at any time. Record only a locally assigned code
such as `P01`; keep consent separately from observations. Do not place names, contact details or raw
recordings in the repository.

## Neutral task

“Starting from the page as shown, create a different next-token branch, compare it with the original
and preserve your result. Tell me what changed and what did not.”

Do not instruct the participant to press **Force runner-up branch** unless they cannot recover after
their first attempt. Do not teach the model-versus-sampler distinction before asking the final
question.

## Observations

Record:

1. time from task start to first committed child branch;
2. whether the participant found the comparison without assistance;
3. whether they added a reflection and exported the trace;
4. hesitation, wrong turns, recovery and assistance given;
5. their answer to “Did the model change, did the selection process change, or both?”; and
6. whether they described the forced alternative as hidden intent, thought or desire.

## Result rule

A session completes when the participant commits a child branch, identifies the changed selection,
recognises that the baseline remains fixed and exports the record. The two-minute target is a product
goal, not a reason to discard slower results. A repeated misunderstanding of forced selection as
hidden model intent is a launch-blocking comprehension finding until copy or interaction is repaired
and retested.

Publish only aggregated completion count, median/range time, common recovery points, comprehension
count and the resulting product changes. Preserve `blocked` or `not-run` if representative sessions
were not conducted.
