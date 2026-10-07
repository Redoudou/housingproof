# Housingproof

A standalone MVP demonstrating how a New York City agency could ask a fixed, approved question and receive a verifiable YES or NO from a confidential RPIE filing without receiving the underlying data.

The product story is:

- DOF keeps the filing.
- An authorized agency asks an approved question.
- A verifiable YES or NO comes back.

This repository is independent of Lease On The Block.

## Milestone one scope

This repository implements the first milestone for the synthetic demonstration.

- A narrow internal JSON schema matching the NYC RPIE worksheet concepts.
- Synthetic filings for one fictional 40-apartment building: 24, 20, 19, invalid, and incomplete.
- A local custodian service that validates filings, stores private data server-side, and signs a DOF manifest.
- A minimal TypeScript frontend with two views: a DOF simulation and an agency portal.
- A Noir circuit proving the fixed threshold question: “Does this filing report at least 20 rent-regulated residential units?”
- An answer bundle export and standalone verification CLI.
- Documentation of the synthetic demo and the next planned milestone.

## Fixed question

Approved question:

“Does this filing report at least 20 rent-regulated residential units?”

Approved threshold: 20

This is the only supported question in milestone one.

## Architecture

- `data/filings.json` — synthetic filings for the demo.
- `docs/rpie-schema.md` — internal schema and mapping notes for the narrow RPIE subset.
- `src/filings.ts` — validation, commitment generation, DOF manifest logic, and threshold evaluation.
- `src/proof.ts` — actual integration with Noir and Barretenberg if the environment has the required CRS and toolchain installed.
- `server/custodian.ts` — local custodian service and API.
- `public/` — minimal UI for the DOF environment and the agency portal.
- `circuits/threshold_question/` — Noir circuit implementing the threshold question.
- `scripts/verify-bundle.ts` — standalone bundle verifier.

## Synthetic dataset and schema

The repository includes a narrow internal schema rather than a legal DOF export schema. It records:

- reporting period
- total dwelling units and regulated unit counts
- annual income categories
- annual operating expenses

The schema is described in `docs/rpie-schema.md` and intentionally excludes identities, addresses, tax identifiers, and tenant information.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Demo flow

1. Load a synthetic filing in the DOF simulation.
2. Register the commitment and signed manifest.
3. Select the filing in the agency portal.
4. Ask the approved threshold question.
5. Receive a YES, NO, missing-data, denied, or failed-verification result.

The UI intentionally does not reveal unit counts or financial values.

## Proof generation and verification notes

This milestone uses a real Noir circuit and a Barretenberg proving backend when the required CRS is available in the runtime environment. The project does not replace cryptographic verification with a fake response.

In this sandbox, the Barretenberg CRS download is blocked by DNS resolution for the hosted CRS endpoints. The code therefore attempts a real proof flow and then reports a clear `failed_verification` result when the local proof tools cannot initialize the CRS. This is a runtime blocker, not a simulated proof result.

## Important caveat

A valid proof verifies that the answer was computed against the reported data in the filing. It does not establish that the owner’s report is accurate, nor does it prove that the filing is legally authorized. The system restricts requests to the fixed approved question and threshold.

## Next milestone

The next milestone is comparing synthetic 2024 and 2025 filings to prove whether a defined operating balance declined by more than 20%. This is intentionally not implemented in milestone one.

## Open blockers

The main blocker for fully automated proof generation in the sandbox is that the Barretenberg CRS endpoints used by `bb` are not resolvable in this environment. The project is structured for real proof generation as soon as those URLs become reachable.
