# Housingproof proof protocol v3

The custodian validates the synthetic residential-only schema, commits to its projection with a private 32-byte random salt, and signs a public manifest with its simulator RSA key. Q001 and Q002 prove computations about that committed projection. Original-form parsing and owner declaration accuracy are outside the circuit.

## Pinned toolchain and hiding mode

- Noir compiler (`noir_wasm`) and witness executor (`noir_js`): **1.0.0-beta.3**.
- Barretenberg (`bb.js`): **0.82.2**, **UltraPlonkBackend**, one WASM thread.
- Commitment: Poseidon2 over the exact 34-field encoding below, using Barretenberg on the host and Noir in the circuit.
- Proof: base64 encoding of the 2,144-byte UltraPlonk proof, with public field elements encoded separately.

Use UltraPlonk deliberately. The default UltraHonk API in this backend version calls `UltraProver`, not a ZK flavor. It was used only for the compatibility spike and is not shipped. UltraPlonk adds random blinding to witness and permutation polynomials. See the pinned upstream [prover implementation](https://github.com/AztecProtocol/aztec-packages/blob/v0.82.2/barretenberg/cpp/src/barretenberg/plonk/proof_system/prover/prover.cpp) and [JS backend](https://github.com/AztecProtocol/aztec-packages/blob/v0.82.2/barretenberg/ts/src/barretenberg/backend.ts).

`circuits/trust.json` pins the SHA-256 of the compiled ABI/bytecode artifact and of its backend-generated VK. Setup compiles both programs and refuses mismatches. Runtime repeats the artifact and VK checks before every operation. Changing those fingerprints is a maintainer trust decision (`node --import tsx scripts/build-zk.ts --update-trust`), never normal setup. Operators must obtain a reviewed repository/trust file independently of the answer bundle.

## Canonical encoding

The projection is a fixed ordered array of 34 BN254 scalar fields. Integer values are exact; counts and financial amounts are range-constrained before use. There are no JSON keys, variable lengths, or field reductions of metadata digests. SHA-256 remains the identity encoder: its full 256-bit output is split into high/low 128-bit limbs.

| Field index | Value |
|---:|---|
| 0 | Big-endian ASCII integer for `housingproof:v3:` |
| 1 | Schema code 1 = `rpie-demo-v1` |
| 2 | Scope code 1 = residential-only v1; commercial/owner counts zero; other-income/reserve/rent-roll flags false |
| 3–4 | High/low limbs of SHA-256 of UTF-8 `housingproof:source:v3\n` + source ID |
| 5–6 | High/low limbs of SHA-256 of UTF-8 `housingproof:property:v3\n` + property ID |
| 7 | Calendar year; January 1–December 31 |
| 8 | Source revision |
| 9–11 | Residential capacity, regulated count, unregulated count |
| 12–14 | Income: regulated, unregulated, other service |
| 15–27 | Thirteen operating expenses in `EXPENSE_KEYS` order |
| 28–31 | Excluded expenses: taxes, bad debt, depreciation, mortgage interest |
| 32–33 | High/low 128-bit limbs of the private 32-byte registration salt |

The host calls Barretenberg `poseidon2Hash`; Noir calls `Poseidon2::hash(fields, 34)`. Length is fixed at 34 in both sponge implementations. Public metadata limbs are reconstructed exactly by the verifier. Private salts originate from 32 cryptographically random bytes. The circuit accepts Field salts but any accepted proof must open the exact issuer-signed commitment; it does not assert a separate entropy claim about the salt.

Successful witness execution against the signed host digest establishes the shared host/circuit vector. Altered salt, components, metadata and bounds are rejected in the circuit suite. The salted `rawDigest` in the manifest is a source-record audit reference and is **not** recomputed by the circuit. Normalization is trusted to the issuer.

## Public inputs and constraints

Noir flattens `Source` in this exact order: commitment, two source-ID hash limbs, two property-ID hash limbs, year, revision. Each becomes a zero-padded 32-byte field represented as `0x` + 64 hex digits. Q001 has one Source (7 fields), Q002 has current then prior Source (14 fields). Both append predicate number, catalog version, fixed threshold, and Boolean answer. Total: 11 or 18 public fields. The verifier reconstructs this array from signed manifests and the approved catalog and requires exact equality.

Private inputs: capacity, regulated/unregulated counts, all three income components, all thirteen operating expenses, all four excluded expenses, and registration salt for each source.

Both circuits constrain years to 2024/2025, revisions to 1–1,000,000, capacity/counts to at most 10,000, count reconciliation, and each amount to at most 10^12 cents. Source hashes and public metadata are inside the recomputed commitment.

- **Q001:** predicate 1, version 1, threshold 20; public answer equals `regulated >= 20`.
- **Q002:** predicate 2, version 1, threshold 2000; same property hash, consecutive years, positive prior balance, public answer equals `10000*(P-C) > 2000*P`. Balance includes income and operating expenses, excluding the separate expense section. Signed i64 products are bounded by 1.6×10^17, below 2^63−1.

## Issuance, proving and verification

Source manifests bind issuer, source/property IDs, year, schema, revision, commitment scheme/digest, raw audit digest, and issue time. RSA-SHA256 signature verification uses an operator-supplied issuer public key. No bundle-supplied trust anchor is accepted. Version-1 commitments and bundle-2 receipts are deliberately incompatible; re-register sources after upgrading.

One proof request runs at a time. A child process receives witness data on stdin, holds it in memory, and exits after proving; no witness/prover file is created. The service caps input/output size and kills a worker after 180 seconds. Backend diagnostics are not forwarded to public responses or application logs. A fresh proof is checked by the worker, then by the public-bundle verifier before a Boolean/export is released. There is no proof cache or replay mode.

Standalone verification needs only public bundle, separately trusted public issuer key, reviewed source/lockfile/trust fingerprints, and compiled public artifacts. It needs no dataset, schema JSON, custodian server, issuer private key or salt. `test:zk` copies the minimal verifier into an isolated directory and verifies there. The UI's verification panel uses a separate public-only request to the local service; it illustrates verification, not a separate deployment.

## Demo limits

This is unaudited prototype code over synthetic records. Keys and disclosures are local; registrations and the bounded 1,000-entry disclosure log reset on restart. Issuer keys persist in ignored `server/keys/`. All callers are the simulated agency; there is no production authentication, expiry/revocation, recipient-specific policy or legal permission. Stable commitments link answers about the same registration. Public metadata and the requested Boolean are intentionally disclosed. A pilot requires source lifecycle controls and reviewed authority to release each answer.
