# Housingproof implementation rules

Read README.md, docs/mvp-plan.md, and docs/implementation-review.md first. This is a standalone synthetic RPIE project, with an existing Express/TypeScript service and plain browser interface. Preserve that small architecture unless a milestone needs a specific change.

- All filings and issuance are simulated. Never add real addresses, identifiers, identities, or confidential data.
- data/schema.json is the normalized subset contract; data/predicates.json fixes Q001 at 20. Q002 is fixed at 2000 basis points with a strict > comparison and a positive prior balance.
- A local Boolean or a signed source receipt is not a ZK-verified answer. Never mark a result verified or enable export without actual independently checked proof bytes and trusted keys.
- Noir beta.3 / Barretenberg 0.82.2 use UltraPlonk, not the default non-ZK UltraHonk mode. Preserve the shared 34-field Poseidon2 encoding and circuit public-input order. Circuit changes require reviewed trust fingerprints and real proof tests.
- Witnesses, salt, private keys, counts, and financial values stay in the custodian environment. Public bundles contain approved answers and metadata only.
- The verifier uses separately supplied trusted public keys and a pinned circuit verification key, never trust anchors from the bundle.
- Invalid/incomplete input, denied questions, unavailable proving tools, and rejected proofs are distinct states. None is a valid NO.
- Run npm run check and npm test before pushing. Add real circuit/proof tests when implementing cryptography; application unit tests are not substitutes.
- Update implementation status and blockers accurately. Do not diagnose every backend error as a CRS failure. Do not claim a milestone complete from source code alone.
