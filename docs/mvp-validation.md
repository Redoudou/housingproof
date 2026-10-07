# MVP validation — October 7, 2026

The final implementation uses **Noir 1.0.0-beta.3 / Barretenberg 0.82.2 / UltraPlonk**, with the shared 34-field Poseidon2 source commitment. The earlier default UltraHonk spike and the slow SHA-256-in-circuit experiment are not the delivered stack.

## Passed locally

- `npm run zk:build`: both compiled artifacts and generated VKs match pinned fingerprints; repeated ordinary setup preserves trust.
- `npm run check`: TypeScript and all dataset boundary/invalid fixture checks.
- `npm test`: 25 application validation, policy, source-signature, bundle and service failure-path tests.
- `npm run test:zk`: seven fresh proofs, private witness and cross-year constraints, public-bundle tampering, and isolated standalone CLI verification.
- `npm run test:browser`: live Chromium registration → prove → verified answer → export → import → verify; altered answer rejected even when its public-input field is changed too. Genuine Q001 YES/NO and Q002 stress YES, nonpositive prior and incomplete-source failures, disclosure log, no runtime errors, and a 390px mobile layout without overflow.
- `npm run build:site`, JavaScript syntax check, and `git diff --check`.

The standalone verifier test copies only the verifier modules, public artifacts and pinned trust into a separate temporary directory. That directory contains no source dataset, schema JSON, server, salt or issuer private key. It verifies an exported bundle using an operator-supplied public issuer key and returns exit code 0.

## Genuine proof cases

| Predicate | Synthetic scenario | Result |
|---|---|---|
| Q001 | Baseline, 24 reported regulated units | YES |
| Q001 | Exactly 20 | YES |
| Q001 | 19 | NO |
| Q002 | Baseline, 10% decline | NO |
| Q002 | Stress, 30% decline | YES |
| Q002 | Exactly 20% decline | NO |
| Q002 | Negative current balance, positive prior | YES |

Circuit execution rejects changed salt, income, source year, threshold, predicate, answer, oversized counts/amounts, cross-property sources, nonconsecutive years and nonpositive prior balance. Host preconditions also prevent missing/incomparable inputs from reaching proving.

Bundle verification rejects signature-only placeholders, wrong issuer key, modified signatures/source metadata, wrong circuit/VK, altered public inputs, changed proof bytes and changed answer with its public field altered to match. A rejected proof never becomes a valid NO.

## Measurements

[Raw measurements](benchmarks/local-mvp.json). Linux x64, Node v24.19.0, AMD EPYC 9V74 virtual environment with 9 visible logical CPUs and about 9.7 GiB RAM. Each backend uses one WASM thread. These numbers were collected while the proof and browser suites ran concurrently; they are indicative, not a performance guarantee. CI repeats on Node 22.

| Operation | End-to-end generation incl. startup and self-check | Separate verification incl. startup | Proof bytes | Prover process peak RSS |
|---|---:|---:|---:|---:|
| Q001 | 5.9–7.4 s | 4.6–5.0 s | 2,144 | 214–222 MiB |
| Q002 | 11.1–12.0 s | 8.0–10.4 s | 2,144 | 256–267 MiB |

The service performs another public-bundle verification before releasing an answer, so click-to-answer time includes both stages. Proof byte count excludes public fields, signatures and JSON. The UI's proving timer measures backend proving plus its self-check, excluding startup and the subsequent independent verification.

## Scope and remaining pilot decisions

This establishes a working local synthetic demonstration. It does not establish production authorization, source fidelity, independent audit, access control, revocation or availability. The static Pages deployment is a project overview; the Node service supplies live proving locally. Registrations and disclosure logs are in memory and reset at restart. Issuer key provisioning and the public CRS are trust dependencies; the CRS is initialized from backend upstream infrastructure during setup.
