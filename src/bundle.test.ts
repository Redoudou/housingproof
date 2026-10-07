import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyAnswerBundle } from './bundle.js';
import { APPROVED_QUESTION, createSalt, generateManifest, syntheticFilings, type Filing } from './filings.js';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const manifest = generateManifest(syntheticFilings[1] as Filing, createSalt(), privateKeyPem);
const bundle = { version: 'housingproof-bundle-2', predicateId: 'Q001', predicateVersion: 1, question: APPROVED_QUESTION,
  threshold: 20, answer: true, sourceId: manifest.sourceId, propertyId: manifest.propertyId,
  reportingPeriod: manifest.reportingPeriod, schemaVersion: manifest.schemaVersion, sourceRevision: manifest.sourceRevision,
  commitment: manifest.commitment, manifest, publicInputs: { commitment: manifest.commitment, threshold: 20, answer: true }, proof: 'placeholder' };

describe('independent verification fails closed', () => {
  it('never treats a valid signature and arbitrary proof text as a verified answer', async () => {
    expect(await verifyAnswerBundle(bundle, publicKeyPem)).toMatchObject({ verified: false, status: 'service_unavailable' });
  });
  it('rejects a signature-only bundle', async () => {
    expect(await verifyAnswerBundle({ ...bundle, proof: undefined }, publicKeyPem)).toMatchObject({ verified: false, status: 'rejected' });
  });
  it.each([{ threshold: 19 }, { question: 'Different question' }, { answer: false }, { sourceRevision: 2 }, { commitment: 'a'.repeat(64) }, { reportingPeriod: '2024' }])('rejects statement tampering: %j', async (change) => {
    expect(await verifyAnswerBundle({ ...bundle, ...change }, publicKeyPem)).toMatchObject({ verified: false, status: 'rejected' });
  });
});
