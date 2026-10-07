# Housingproof implementation rules

Read README.md, docs/mvp-plan.md, and docs/implementation-review.md first. This is a standalone synthetic RPIE project, with an existing Express/TypeScript service and plain browser interface. Preserve that small architecture unless a milestone needs a specific change.

- All filings and issuance are simulated. Never add real addresses, identifiers, identities, or confidential data.
- data/schema.json is the normalized subset contract; data/predicates.json fixes Q001 at 20. Q002 is planned only.
- A local Boolean or a signed source receipt is not a ZK-verified answer. Never mark a result verified or enable export without actual independently checked proof bytes and trusted keys.
- The legacy Noir circuit is disabled. The next milestone must align commitment encoding, registered private salt, source metadata, public inputs, and a pinned toolchain before enabling it.
- Witnesses, salt, private keys, counts, and financial values stay in the custodian environment. Public bundles contain approved answers and metadata only.
- The verifier uses separately supplied trusted public keys and a pinned circuit verification key, never trust anchors from the bundle.
- Invalid/incomplete input, denied questions, unavailable proving tools, and rejected proofs are distinct states. None is a valid NO.
- Run npm run check and npm test before pushing. Add real circuit/proof tests when implementing cryptography; application unit tests are not substitutes.
- Update implementation status and blockers accurately. Do not diagnose every backend error as a CRS failure. Do not claim a milestone complete from source code alone.
