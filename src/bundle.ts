import { verifyManifestSignature, type Manifest } from './filings.js';
import { POLICIES, type PredicateId } from './policy.js';
import { expectedPublicInputs } from './commitment.js';
import { runProofWorker, trustedCircuit } from './zk-runtime.js';
export type AnswerBundle = {
  version: 'housingproof-bundle-3'; predicateId: PredicateId; predicateVersion: number;
  question: string; threshold: number; answer: boolean;
  manifests: Manifest[]; circuitId: string; verificationKeyHash: string;
  proof: string; publicInputs: string[];
};
export type BundleVerification = { verified: boolean; status: 'verified_yes' | 'verified_no' | 'rejected' | 'service_unavailable'; reason: string };
const BUNDLE_KEYS = ['version', 'predicateId', 'predicateVersion', 'question', 'threshold', 'answer', 'manifests', 'circuitId', 'verificationKeyHash', 'proof', 'publicInputs'].sort().join(',');
export async function verifyAnswerBundle(value: unknown, trustedIssuerKey: string): Promise<BundleVerification> {
  const reject = (reason: string): BundleVerification => ({ verified: false, status: 'rejected', reason });
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== BUNDLE_KEYS) return reject('Malformed bundle');
  const b = value as AnswerBundle;
  if (b.version !== 'housingproof-bundle-3' || !Object.hasOwn(POLICIES, b.predicateId)) return reject('Unapproved bundle or predicate');
  const p = POLICIES[b.predicateId];
  if (b.predicateVersion !== p.version || b.question !== p.question || b.threshold !== p.threshold || typeof b.answer !== 'boolean') return reject('Unapproved statement parameters');
  if (!Array.isArray(b.manifests) || b.manifests.length !== (b.predicateId === 'Q001' ? 1 : 2)
    || !b.manifests.every(m => verifyManifestSignature(m, trustedIssuerKey))) return reject('Invalid source signature or untrusted issuer');
  if (b.predicateId === 'Q002') {
    const [current, prior] = b.manifests;
    if (current.propertyId !== prior.propertyId || Number(current.reportingPeriod) !== Number(prior.reportingPeriod) + 1 || current.schemaVersion !== prior.schemaVersion) return reject('Incomparable source periods or properties');
  }
  const expected = expectedPublicInputs(b.predicateId, b.manifests, b.answer);
  if (!Array.isArray(b.publicInputs) || b.publicInputs.length !== expected.length || !b.publicInputs.every((x, i) => x === expected[i])) return reject('Public inputs do not match signed sources and statement');
  if (typeof b.proof !== 'string' || b.proof.length < 100 || b.proof.length > 100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.proof)
    || Buffer.from(b.proof, 'base64').length !== 2144 || Buffer.from(b.proof, 'base64').toString('base64') !== b.proof) return reject('Malformed or missing cryptographic proof');
  let trust;
  try { trust = trustedCircuit(b.predicateId); } catch { return { verified: false, status: 'service_unavailable', reason: 'Pinned circuit trust is unavailable.' }; }
  if (b.circuitId !== `${b.predicateId}:${trust.artifactHash}` || b.verificationKeyHash !== trust.verificationKeyHash) return reject('Untrusted circuit or verification key');
  try {
    const result = await runProofWorker({ operation: 'verify', id: b.predicateId, proof: b.proof, publicInputs: b.publicInputs });
    if (result.verified !== true) return reject('Cryptographic proof rejected');
    return { verified: true, status: b.answer ? 'verified_yes' : 'verified_no', reason: 'Source signatures, approved statement, public inputs, and ZK proof verified.' };
  } catch {
    return { verified: false, status: 'service_unavailable', reason: 'Proof verifier unavailable or proof could not be processed. No answer accepted.' };
  }
}
