# Housingproof

**Keep the data private. Unlock the answers.**

A standalone synthetic demonstration of a proposed workflow: DOF keeps an RPIE filing, an authorized agency asks a fixed question, and a cryptographically verified answer returns without the filing.

## Current state

The repository has a local custodian/agency interface, validated synthetic data, signed simulator source manifests, and a build plan. **It does not yet generate or independently verify a working ZK proof.**

The initial starter's circuit used an arithmetic commitment while its service used SHA-256. Its verifier checked a source signature without verifying the answer proof. Those do not establish the proposed ZK claim. The unsafe proof path is disabled; the agency interface withholds the answer and reports `service_unavailable`. Signing a source receipt does not put a “verified” label on an answer.

See the authoritative [MVP plan](docs/mvp-plan.md) and [implementation review](docs/implementation-review.md).

## Data and first question

All property identifiers and values are fictional. The dataset contains one 40-apartment property, synthetic 2024/2025 records, scenario variants, and invalid/incomplete inputs. No real addresses, BBLs, BINs, tenant identities, or taxpayer identifiers are present.

The internal [schema](data/schema.json) is mapped to the [official RPIE-2025 worksheet](https://www.nyc.gov/assets/finance/downloads/pdf/rpie/rpie-worksheet.pdf). It is not an official DOF interchange format. [Mapping and limits](docs/rpie-schema.md).

The first approved question is:

> Does this filing report at least 20 rent-regulated residential units?

Its fixed threshold is 20. Local fixture calculations cover 24 → YES, 20 → YES, 19 → NO. These are **arithmetic oracle results, not verified proofs**. A proof would establish computation against reported data; it would not establish that an owner's declaration is accurate or that disclosure is legally authorized.

A second question—whether a defined reported operating balance declined by more than 20%—has fixture cases and a specification, but no circuit or API implementation. An exact 20% decline is NO; an absent or nonpositive prior balance is UNAVAILABLE.

## Run locally

Node.js 22 or later and Python 3 are required.

```bash
npm ci
npm run check
npm test
npm run dev
```

Open http://localhost:3000. The service binds to loopback.

1. Choose a synthetic record and register it in the DOF simulation.
2. Invalid/incomplete records are rejected. A valid record receives a signed source receipt.
3. Ask the approved question. The UI currently explains that proof generation is unavailable; it does not return a verified YES/NO or export an unverified bundle.

Both panels share a local process. They illustrate roles; they are not production authentication or network isolation. Do not deploy this simulation with confidential data.

## Checks and standalone verifier

```bash
npm run check   # TypeScript and source-mapped fixture arithmetic
npm test        # Input, policy, manifest, API, and fail-closed verifier checks
npm run demo    # Private local arithmetic oracle; no cryptography
npm run verify -- answer-bundle.json trusted-issuer-public.pem
```

The verifier takes a separately supplied public trust anchor, never a key from a bundle. It exits unsuccessfully while ZK verification is unavailable. The tests do not claim to validate a proof or circuit. CI repeats the checks.

Private issuer keys are created at runtime under ignored `server/keys/`. Salts remain in the server registration state and are never included in public manifests. Commitments cover the full normalized subset; the current host-side JSON encoding still needs a matching, tested circuit encoding before proofs can be enabled. The signed audit digest is salted and describes serialized synthetic records, not faithful parsing of an original official form.

## Next implementation milestone

Replace the disabled legacy circuit with a fixed-Q001 circuit and shared canonical commitment encoding. Pin compatible Noir/Barretenberg versions and trusted verification keys. Demonstrate genuine YES and NO proofs, then reject altered answers, changed sources/public inputs, and untrusted keys. Export a portable proof bundle and verify it without the filing. Only then enable a verified UI state.

No blockchain, wallet, real City integration, production deployment, or real-data access is part of this milestone.
