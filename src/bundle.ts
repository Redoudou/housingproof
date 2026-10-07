import { APPROVED_QUESTION, APPROVED_THRESHOLD, PREDICATE_ID, verifyManifestSignature, type Manifest } from './filings.js';

type AnswerBundle = {
  version: string; question: string; predicateId: string; predicateVersion: number; threshold: number; answer: boolean;
  sourceId: string; propertyId: string; reportingPeriod: string; schemaVersion: string; sourceRevision: number;
  commitment: string; manifest: Manifest; proof: string;
  publicInputs: { commitment: string; threshold: number; answer: boolean };
};
export type BundleVerification = { verified: false; status: 'rejected' | 'service_unavailable'; reason: string };

// An issuer signature authenticates a source manifest, not a computed answer.
// Never return verified=true until a genuine proof is checked using a trusted VK.
export async function verifyAnswerBundle(value: unknown, trustedIssuerKey: string): Promise<BundleVerification> {
  const reject = (reason: string): BundleVerification => ({ verified: false, status: 'rejected', reason });
  if (!value || typeof value !== 'object') return reject('Malformed bundle');
  const bundle = value as AnswerBundle;
  if (bundle.version !== 'housingproof-bundle-2' || bundle.predicateId !== PREDICATE_ID || bundle.predicateVersion !== 1
    || bundle.question !== APPROVED_QUESTION || bundle.threshold !== APPROVED_THRESHOLD || typeof bundle.answer !== 'boolean') return reject('Unapproved statement or bundle version');
  if (!bundle.manifest || !verifyManifestSignature(bundle.manifest, trustedIssuerKey)) return reject('Invalid signature or untrusted issuer');
  for (const key of ['sourceId', 'propertyId', 'reportingPeriod', 'schemaVersion', 'sourceRevision', 'commitment'] as const)
    if (bundle[key] !== bundle.manifest[key]) return reject('Statement does not match the signed source');
  if (!bundle.publicInputs || bundle.publicInputs.threshold !== bundle.threshold || bundle.publicInputs.answer !== bundle.answer
    || bundle.publicInputs.commitment !== bundle.commitment) return reject('Public inputs do not match the statement');
  if (typeof bundle.proof !== 'string' || !bundle.proof.length) return reject('No cryptographic proof supplied');
  return { verified: false, status: 'service_unavailable', reason: 'Independent ZK verification and a trusted circuit verification key are not implemented. Signature checks alone do not verify an answer.' };
}
