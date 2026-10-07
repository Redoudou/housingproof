import { describe, expect, it } from 'vitest';
import { verifyAnswerBundle } from './bundle.js';
import { syntheticFilings } from './dataset.js';
import { createSalt, generateIssuerKeys, generateManifest, type Filing } from './filings.js';
import { POLICIES } from './policy.js';
import { expectedPublicInputs } from './commitment.js';
import { trustedCircuit } from './zk-runtime.js';
const { privateKeyPem: privateKey, publicKeyPem: publicKey } = generateIssuerKeys();
const manifest = generateManifest(syntheticFilings[1] as Filing, createSalt(), privateKey);
const trust = trustedCircuit('Q001');
const bundle = { version: 'housingproof-bundle-3', predicateId: 'Q001', predicateVersion: 1, question: POLICIES.Q001.question,
  threshold: 20, answer: true, manifests: [manifest], circuitId: `Q001:${trust.artifactHash}`, verificationKeyHash: trust.verificationKeyHash,
  publicInputs: expectedPublicInputs('Q001', [manifest], true), proof: 'placeholder' };
describe('bundle validation before cryptographic verification', () => {
  it('rejects signature-only and placeholder-proof bundles', async () => {
    for (const proof of ['placeholder', '', undefined]) expect(await verifyAnswerBundle({ ...bundle, proof }, publicKey)).toMatchObject({ verified: false, status: 'rejected' });
  });
  it.each([{ threshold: 19 }, { question: 'Different question' }, { answer: false }, { predicateId: 'Q003' }, { version: 'housingproof-bundle-2' }, { publicInputs: [] }])('rejects statement tampering: %j', async change => {
    expect(await verifyAnswerBundle({ ...bundle, ...change }, publicKey)).toMatchObject({ verified: false, status: 'rejected' });
  });
  it.each([{ sourceRevision: 2 }, { commitment: 'a'.repeat(64) }, { reportingPeriod: '2024' }])('rejects source tampering: %j', async change => {
    expect(await verifyAnswerBundle({ ...bundle, manifests: [{ ...manifest, ...change }] }, publicKey)).toMatchObject({ verified: false, status: 'rejected' });
  });
  it('rejects an injected trust anchor or private material', async () => {
    expect(await verifyAnswerBundle({ ...bundle, issuerPublicKey: publicKey }, publicKey)).toMatchObject({ verified: false, status: 'rejected' });
  });
});
