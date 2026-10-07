# Starter review and implementation priorities

Reviewed October 7, 2026 at `aee0a5d`, after the initial Copilot PR merged. The [MVP plan](mvp-plan.md) adapts the earlier planning package to this standalone repository.

| Starter gap | Why it matters | Resolution / next work |
|---|---|---|
| Service SHA-256 versus circuit arithmetic commitment | A proof would concern a different source statement | Integration disabled. Implement one shared encoding and test host/circuit vectors |
| Prover generated a different salt from registration | Proving source would not match signed source | Registration owns the private salt; future prover receives that exact registration |
| Threshold private and not constrained to 20 in circuit | A different threshold could produce an accepted answer | Future circuit and verifier must enforce fixed Q001 parameters |
| CLI verified only signature and threshold | Answer or proof could be changed without proving correctness | Fail-closed verifier boundary; no `verified: true` until real proof verification |
| Export described filesystem paths as proof material | Another machine could not verify an exported bundle | Portable proof bytes/public inputs and independently trusted VK required |
| Salt exposed in manifest | Small-domain source values could be guessed | Removed from public receipt; kept private |
| Generic P&L fields and taxes in operating expenses | Not the specified worksheet subset/balance | Source-mapped dataset/schema; excluded costs separate |
| Invalid input could receive a signed receipt | Issuance could authenticate an incomplete source | Full subset validation before registration |
| Failure still returned “valid_yes”/“Verified” text | UI could imply proof success despite failure | No Boolean or bundle on unavailable proof; explicit unavailable state |
| ESM executable lookup, witness formatting, shared files, and guessed backend options | Toolchain failures were incorrectly attributed only to CRS | Unsafe path removed from runtime. Pin and test toolchain before diagnosing CRS or enabling proofs |

## First implementation PR after this alignment

1. Select and pin a compatible Noir compiler, Barretenberg backend, circuit hash, and proof format.
2. Define a fixed ordered encoding for the complete signed projection and private salt. If it replaces the current host JSON encoding, version the receipt and commitment scheme together.
3. Q001 constrains ranges and source metadata, recomputes the signed commitment, and returns a public Boolean for the fixed 20-unit question. Both YES and NO must be provable.
4. Generate real proofs using the registered source and salt; isolate per-request artifacts, set timeouts, and keep witness paths/data out of public bundles and logs.
5. Pin a trusted verification key locally. Verify proof bytes and all public statement/source bindings; then check the separately trusted simulator signature.
6. Exercise YES/NO, exact threshold, altered answer, wrong source/period, arbitrary VK, and signature-only attacks. Record machine details, proof time/size, and independent verification time.
7. Enable verified answer display/export only after those checks pass. Report unavailable tools, denied queries, invalid sources, and rejected proofs separately.

Q002 comes afterward. Cohort answers, public-data joins, authentication, real DOF ingestion, and disclosure authority remain separate work. Do not expand scope to work around missing proof verification.
