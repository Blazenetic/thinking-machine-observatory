# ADR 0006 — Content-addressed logit payloads

- Status: Proposed; codec spike verified
- Date: 24 August 2026

## Context

Schema 1.1 deliberately proves exact live replay by storing all 50,257 expanded sampler candidate records. For one step this produces 24,179,109 bytes of JSON and approximately 187 MB additional heap in the recorded harness. Repeating that representation across baseline and child futures would make Phase 3 impractical and would store derived fields many times.

The measured float32 vector itself is only 201,028 bytes. It is already identified by a SHA-256 in inference provenance and is sufficient, together with decoded specimens, sampler configuration, interventions and PRNG state, to reproduce every derived sampler field.

## Proposed decision

Introduce a schema 1.2 payload table keyed by SHA-256. Encode an embedded logit vector as canonical little-endian float32 bytes represented by canonical base64:

```json
{
  "encoding": "float32-le-base64",
  "sha256": "0c2ea665…",
  "valueCount": 50257,
  "data": "…"
}
```

Generation steps reference the content address rather than duplicating expanded raw and derived candidate records. A step retains its sampler configuration, interventions, selection, PRNG cursor and the decoded token specimens required by the interface. Import verifies encoding, exact byte length, finite values and SHA-256 before sampling.

The content address is over the binary little-endian bytes, not JSON or base64 text. It therefore remains the same `0c2ea665…` identity already recorded for the accepted hero runtime vector.

Schema 1.1 stays readable. A 1.1 import may be normalised in memory, but no migration may discard its expanded evidence before equivalent replay succeeds. Schema 1.2 export is compact by default and embeds referenced payloads once so a downloaded trace remains self-contained.

The checked codec is a readiness spike under `packages/trace-schema/src/logit-payload.ts`; it is intentionally not exported from the package or wired into the production schema until the 1.2 migration and replay adapter land together. Its provisional one-million-value ceiling bounds allocation during the spike; work package 3A must review and enforce the final trace-level byte, vector and payload-count limits before parsing payload data.

## Evidence

The production hero vector was encoded, decoded, hashed and fed through the production sampler on both sides:

| Representation                    |      Bytes |
| --------------------------------- | ---------: |
| Schema 1.1 expanded one-step JSON | 24,179,109 |
| Embedded payload JSON             |    268,178 |
| Embedded payload gzip             |    184,967 |

The payload JSON is 98.89% smaller than the expanded trace. All sampler fields were deeply equal and the selected token remained ID `3223` (`" dark"`). Evidence is checked in `model-tools/verification/compact-payload-spike-report.json` and reproduced by `pnpm payload:verify`.

## Consequences

- Multi-step traces can deduplicate identical measurements and avoid serialising redundant eliminated-candidate fields.
- Exact replay now depends on a verified payload resolver; a missing or corrupt payload is a hard compatibility failure.
- Base64 adds roughly one third to the raw binary size but preserves portable single-file JSON and is still two orders of magnitude smaller than the expanded record.
- IndexedDB may store payloads once by content address while notebooks store lightweight references.
- Derived candidate views should be computed lazily and memoised; they are not independent evidence.
- External payload files, compression codecs and network fetches remain future options, not part of the initial 1.2 contract.
