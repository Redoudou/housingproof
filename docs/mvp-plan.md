# Housingproof: MVP build plan

Updated October 7, 2026. This remains the authoritative scope and trust model. The local synthetic MVP now implements Q001 and Q002 with fresh UltraPlonk proofs, public bundle export, and independent verification. See [protocol](proof-protocol.md) and [validation evidence](mvp-validation.md).

## Current status

| Area | Implemented | Pilot work outside this MVP |
|---|---|---|
| Dataset | Source-mapped subset, two years, synthetic boundary and stress cases | Reviewed original-form ingestion |
| Ingestion | Validation, private salt, signed fixed-order source commitment | Persistence and key lifecycle |
| Circuits | Q001 / Q002, shared Poseidon2 field encoding, bounds and fixed catalog parameters | Independent security audit |
| Verification | Real proof bytes, public-input binding, pinned circuit/VK, separate issuer trust anchor | Operational trust distribution and revocation |
| API/UI | Register → approve → prove → verify → export; changed-answer rejection; disclosure log | Authentication and separate deployments |

Both YES and NO are proven. Invalid, unavailable, denied and rejected states release no answer or bundle. All records and issuance are synthetic.

## The demonstration

**DOF keeps the filing. An agency asks an approved question. Only a verified answer returns.**

Use one fictional 40-apartment building, two calendar-year filings (2024 and 2025), and two questions. The custodian loads a synthetic filing into a simulated DOF service. The agency chooses a question and sees YES or NO, the reporting period, and an independently checked proof. A changed answer or mismatched filing is rejected. End on the housing decision the answer could inform, rather than on cryptographic internals.

All inputs, property identifiers, and issuance are synthetic. Use `DEMO-RPIE-001`, not a plausible real BBL or BIN. This standalone repository contains no real-property dataset; retain that boundary. No public-data joins, blockchain, real identities, arbitrary questions, or cohort statistics are needed for this first demonstration.

## What the official sources establish

The linked [RPIE-2025 worksheet](https://www.nyc.gov/assets/finance/downloads/pdf/rpie/rpie-worksheet.pdf), revised March 2, 2026, is preparation guidance, **not the submission form**. Actual filing is electronic. Use its field labels for the mock record; do not present our JSON as an official DOF interchange format. The [forms page](https://www.nyc.gov/site/finance/property/property-rpie-forms.page) identifies the June 1, 2026 deadline for RPIE-2025.

The minimum mapping is deliberately narrow:

| Canonical field | Worksheet location | Meaning in this MVP |
|---|---|---|
| `reporting_period` | I | Calendar-year bounds |
| `residential_units` | E.1 | Residential capacity |
| `regulated_units_reported`, `regulated_rental_income_cents` | J.1a | Reported regulated count and annual receipts |
| `unregulated_units_reported`, `unregulated_rental_income_cents` | J.1b | Reported unregulated count and annual receipts |
| `other_service_income_cents` | J.10d | One other income category used in the fixtures |
| `operating_expenses_cents` | L(I).1–13 | All thirteen expense slots, including explicit zeroes |
| `excluded_expenses_cents` | L(I).15 | Stored separately; excluded from this calculation |

For this residential-only subset, all other income categories and replacement-reserve activity are explicitly declared absent. Totals are calculated from the supplied components, not accepted as another owner-controlled input. This is not a full RPIE reconstruction or DOF valuation formula. The 2024 fixture uses the same MVP projection for comparison; it is not an independently mapped 2024 form.

The [rent-roll FAQ](https://www.nyc.gov/site/finance/property/property-rpie-rent-roll.page) defines end-of-reporting-period occupancy and latest monthly rent, whereas worksheet E vacancy has its own taxable-status date. Do not substitute one date for the other. Annual receipts are not twelve times the latest monthly rent. Unit rents do not establish legal rents or lawful increases.

The [published column definitions](https://www.nyc.gov/assets/finance/downloads/pdf/rpie/rent-roll-column-definitions.pdf) are useful for later unit-level ingestion, but their simplified regulation-status wording must be checked against the current downloadable template. That template has not been retrieved here. The first two questions therefore use the main statement, without depending on rent-roll enums. A later 40-row synthetic rent roll can show the richness of the protected source without expanding the first circuits. This has not been created.

## First dataset

See `../data/schema.json`, `../data/fixtures/demo-cases.json`, and `../data/filings.json`. Amounts are integer USD cents. Every record is labeled synthetic. No SSN, EIN, tenant name, actual address, or real government identifier is needed. The bundle contains a prior-year filing, a baseline current-year filing, and explicitly separate scenario variants. Variants are not a history of events at a real property.

| Scenario | Reported regulated units | Computed operating balance | Q001 | Q002 |
|---|---:|---:|---|---|
| Prior year (2024) | 24 | $600,000 | — | — |
| Baseline (2025) | 24 | $540,000 | YES | NO |
| Financial stress variant | 24 | $420,000 | YES | YES |
| Unit-count boundary | 20 | $540,000 | YES | NO |
| Below unit-count boundary | 19 | $540,000 | NO | NO |
| Exactly 20% decline | 24 | $480,000 | YES | NO |
| Negative current balance | 24 | −$100,000 | YES | YES |
| Missing prior-year source | 24 | $540,000 | YES | UNAVAILABLE |
| Nonpositive prior balance | 24 | $540,000 | YES | UNAVAILABLE |

## Exact questions

`../data/predicates.json` is the versioned draft catalog. Only the two listed parameter choices are authorized in the demo. Future configuration means approving a catalog entry, not accepting arbitrary requester thresholds.

**Q001:** “Does this filing report at least 20 rent-regulated residential units?”

Result is `regulated_units_reported >= 20`. It proves the count in J.1a, not compliance, legal regulation status, occupancy, or the truth of the owner's declaration.

**Q002:** “Did the operating balance calculated from reported income and expenses fall by more than 20% from the previous year?”

Define the MVP balance as the three included income components minus L(I).1–13. Label it “calculated reported operating balance”; do not call it DOF-assessed NOI. For positive prior balance `P` and current balance `C`, result is:

`10_000 * (P - C) > 2_000 * P`

Strictly greater means exactly 20% returns NO. Use signed arithmetic for `P - C` and negative balances, and bounded arithmetic before multiplication. Missing prior filing, nonpositive prior balance, incomplete inputs, or incomparable periods produce UNAVAILABLE before proving; neither YES nor NO is appropriate. Both source manifests must identify the same fictional property, consecutive full calendar years, and the same schema. An unknown predicate or changed threshold is DENIED. An invalid proof is REJECTED, not NO.

## Trust boundary and implementation structure

Retain the current small Express/TypeScript application and plain browser UI. `server/custodian.ts` is the simulated protected environment; `public/` is the requester interface. A separate verifier must be able to run with only an exported public bundle and trusted public keys. Two panels served by one local process demonstrate roles, not production isolation or authorization.

Implementation paths already present:

- `src/filings.ts`: subset validation, canonical projection, signed simulator manifests, local arithmetic oracle.
- `src/proof.ts`: live Q001 / Q002 proof orchestration and precondition checks.
- `src/bundle.ts`: source signatures, exact public-input binding, and independent proof verification.
- `server/custodian.ts`: local load/register/query API.
- `circuits/threshold_question/`, `circuits/balance_decline/`, `circuits/source_projection/`: fixed catalog circuits and shared commitment encoding.
- `scripts/verify-bundle.ts`: standalone verification using an independently supplied public issuer key and pinned local circuit/VK fingerprints.
- `public/`: simulated custodian and agency views. English is sufficient for the first milestone.

Implemented stack: Noir compiler and NoirJS **1.0.0-beta.3**, Barretenberg **0.82.2**, **UltraPlonk**. The initial UltraHonk spike was replaced because its default mode is not the ZK variant. `npm run zk:build` compiles locally and checks deterministic artifact and VK hashes against `circuits/trust.json`; ordinary setup cannot silently replace trust anchors. Genuine proof tests establish compatibility for this exact combination.

At ingestion, the simulated issuer validates the subset and produces a signed manifest binding property, period, source revision, schema version, salted serialized-record digest, and a salted commitment to the canonical circuit projection. The issuer private key remains in the custodian service. The verifier pins its demo public key; it must not accept a key supplied by the prover as its trust anchor.

The salted serialized-record digest is an audit reference, not a digest of an unparsed original filing. The ZK circuit proves facts about the normalized projection. The issuer's normalization and its link to the original filing are trusted outside the circuit. Do not claim the circuit parses or proves the fidelity of a complete original form. Source revision changes require a fresh commitment and signed manifest; never silently reuse the old identity. Fresh private randomness protects commitments against guessing small-domain hidden values. Stable commitments still link answers about the same source.

Freeze an explicit, versioned field order and integer encoding before proving. The commitment includes a domain tag, schema, property identity, year/period, source revision, counts, all included income/expense components, and private salt. Strings become unambiguously encoded identifiers; do not hash loosely ordered JSON and claim it matches a circuit commitment. Use a documented circuit-supported hash, with shared host/circuit test vectors. Put bounds on every count and amount; range-check before sums, signed subtraction, and products. The proposed amount cap is 10^12 cents per line and count cap is 10,000. The implemented circuits use signed 64-bit arithmetic: each balance is between −13×10^12 and 3×10^12 cents, and the largest scaled difference is 1.6×10^17, below 2^63−1. Counts and amount ranges are constrained before sums and products. This replaces the earlier proposed 128-bit representation; Noir beta.3 supports the sufficient 64-bit signed type.

Private inputs: canonical projection(s) and salt(s). Public inputs: commitment(s), predicate and circuit versions, approved threshold, property/period/revision binding, and Boolean result. The circuit enforces `result == computed_predicate`, allowing genuine proofs of both YES and NO. It must recompute commitment(s) from the witness and constrain any cross-year consistency checks it claims to prove.

An exported answer bundle contains the public statement, signed manifest(s), proof, and circuit identity. The verifier uses its own allowlisted verification key and checks signature, public-input equality, statement parameters, source binding, and proof. A proof generated for some other circuit, year, commitment, or answer must fail application verification. Provenance and computation are separate checks. “Issued by simulated DOF” must remain visible; no real City endorsement is implied.

## Build sequence and completion gates

| Milestone | Deliverable | Completion evidence |
|---|---|---|
| 0. Dataset and specification | This schema, fixture cases, source mapping, and exact catalog | Fixture arithmetic and failure cases validated; source limitations recorded |
| 1. Cryptographic spike | Q001 circuit, salted commitment, simulator signature, standalone verifier | Generate fresh YES and NO proofs; altered answer, witness/commitment, source manifest, or untrusted key rejected; record proving/verification time, memory, proof size, and machine details |
| 2. Cross-year computation | Q002 circuit using both committed periods | Strict boundary and negative-current cases correct; mismatched property/years rejected; undefined prior balance blocked |
| 3. Custodian service and policy | Local load → validate → issue → authorize → prove flow | Agency network payloads/logs contain no raw source or witness; rejected requests do not trigger proving; repeat requests reuse an approved statement without changing thresholds |
| 4. Two-screen demo | Custodian simulation and separate agency query/verify experience | English; success, unavailable, denied, rejected, and service-failure states; recording-ready click path |
| 5. City review package | Reproducible demo and architecture handoff | Another machine verifies an exported bundle without source files or issuer private key; explicit list of integration, legal, and operational decisions for a real sample |

Current evidence covers milestones 0–4 for the local synthetic demo: genuine YES/NO proofs for both predicates, private witness and public statement constraints, fail-closed service states, export/import and changed-answer rejection, plus isolated CLI verification without dataset or private-key files. The [validation report](mvp-validation.md) records actual measurements. Milestone 5 remains the City review and authorization handoff, not a claim of deployment readiness.

Run `npm run check`, `npm test`, `npm run zk:build`, and `npm run test:zk`. `npm run test:browser` exercises the real click path after `npx playwright install chromium`. CI repeats these checks. The maintainer reviews and merges changes.

## Limits the story must preserve

An answer discloses the approved Boolean and public metadata. ZK hides additional witness values; it does not make answers reveal nothing. Fixed thresholds reduce adaptive extraction but do not guarantee privacy against linked questions or outside information. Maintain a per-recipient/property/period disclosure log and an allowlist. Cohort statistics need an additional completeness and disclosure design; they are later work.

The historical [DOF rules document](https://www.nyc.gov/assets/finance/downloads/pdf/04pdf/rule_rpie.pdf) includes disclosure restrictions and anonymized-statistics language. It is an amendments document, not a verified current consolidated legal authority. Before real inputs or real recipients, DOF and Corporation Counsel must assess the current rules and which derived answers may be released. A ZK proof does not itself grant access or establish compliance with confidentiality law. Do not assume universal filing, guaranteed legal permissibility, or automatic elimination of inaccurate reporting.

HPD triage, owner eligibility evidence, RGB analysis, and advocate-facing outcomes are potential applications, not existing entitlements. This MVP demonstrates a capability with synthetic records. A real trial still needs source access inside DOF, amendment/freshness rules, approved predicates and recipients, operational key management, and a reviewed normalization map.
