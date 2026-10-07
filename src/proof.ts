import { createSalt, generateManifest, validateFiling, type Filing, type Manifest } from './filings.js';
import { POLICIES, type PredicateId, EXPENSE_KEYS } from './policy.js';
import { computeSaltedCommitment, expectedPublicInputs, sourceInput, projectionInput } from './commitment.js';
import { runProofWorker, trustedCircuit } from './zk-runtime.js';
import type { AnswerBundle } from './bundle.js';
export type Registration = { filing: Filing; salt: string; manifest: Manifest };
export function createRegistration(filing: Filing, privateKeyPem: string): Registration {
  const salt = createSalt();
  return { filing, salt, manifest: generateManifest(filing, salt, privateKeyPem) };
}
export type ProofResult = { status: 'proved'; bundle: AnswerBundle; provingMs: number; proofBytes: number; peakRssKb: number } | { status: 'service_unavailable' | 'missing_data' | 'rejected'; message: string };
export function operatingBalance(f: Filing): bigint {
  return BigInt(f.income.regulated_rental_income_cents) + BigInt(f.income.unregulated_rental_income_cents) + BigInt(f.income.other_service_income_cents)
    - EXPENSE_KEYS.reduce((sum, k) => sum + BigInt(f.operating_expenses_cents[k]), 0n);
}
export function answerFor(id: PredicateId, current: Filing, prior?: Filing): boolean | null {
  if (!validateFiling(current).valid || prior && !validateFiling(prior).valid) return null;
  if (id === 'Q001') return current.income.regulated_units_reported >= POLICIES.Q001.threshold;
  if (!prior || current.property.property_id !== prior.property.property_id || current.reporting_period.year !== prior.reporting_period.year + 1 || current.schema_version !== prior.schema_version) return null;
  const p = operatingBalance(prior), c = operatingBalance(current);
  return p > 0n ? 10000n * (p - c) > BigInt(POLICIES.Q002.threshold) * p : null;
}
export async function generateProof(id: PredicateId, current: Registration, prior?: Registration): Promise<ProofResult> {
  const answer = answerFor(id, current.filing, prior?.filing);
  if (answer === null) return { status: 'missing_data', message: 'Complete comparable periods and a positive prior operating balance are required.' };
  const p = POLICIES[id], sources = [current, prior!].slice(0, p.sources);
  if (sources.some(r => computeSaltedCommitment(r.filing, r.salt) !== r.manifest.commitment)) return { status: 'rejected', message: 'Registered source no longer matches its commitment.' };
  const manifests = sources.map(r => r.manifest);
  const inputs = id === 'Q001' ? { source: sourceInput(current.manifest), values: projectionInput(current.filing, current.salt) }
    : { current: sourceInput(current.manifest), prior: sourceInput(prior!.manifest), current_values: projectionInput(current.filing, current.salt), prior_values: projectionInput(prior!.filing, prior!.salt) };
  try {
    const trust = trustedCircuit(id);
    const result = await runProofWorker({ operation: 'prove', id, inputs: { ...inputs, predicate: p.number, version: p.version, threshold: p.threshold, answer } });
    if (JSON.stringify(result.publicInputs) !== JSON.stringify(expectedPublicInputs(id, manifests, answer))) return { status: 'rejected', message: 'Proof public inputs do not match the approved statement.' };
    return { status: 'proved', provingMs: result.provingMs, proofBytes: result.proofBytes, peakRssKb: result.peakRssKb,
      bundle: { version: 'housingproof-bundle-3', predicateId: id, predicateVersion: p.version, question: p.question, threshold: p.threshold,
        answer, manifests, circuitId: `${id}:${trust.artifactHash}`, verificationKeyHash: trust.verificationKeyHash,
        proof: result.proof, publicInputs: result.publicInputs } };
  } catch { return { status: 'service_unavailable', message: 'Proof generation unavailable. Run npm run zk:build and check the pinned toolchain. No answer released.' }; }
}
