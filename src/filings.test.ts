import { describe, expect, it } from 'vitest';

import { APPROVED_QUESTION, APPROVED_THRESHOLD, createSalt, ensureIssuerKeys, evaluateThreshold, generateManifest, syntheticFilings, validateFiling, verifyManifestSignature } from './filings.js';

describe('housingproof filing logic', () => {
  it('accepts the supported threshold question', () => {
    expect(APPROVED_QUESTION).toBe('Does this filing report at least 20 rent-regulated residential units?');
    expect(APPROVED_THRESHOLD).toBe(20);
  });

  it('marks 24 regulated units as a valid yes and 19 as a valid no', () => {
    const yes = evaluateThreshold(syntheticFilings[0], APPROVED_QUESTION);
    const no = evaluateThreshold(syntheticFilings[2], APPROVED_QUESTION);

    expect(yes.status).toBe('valid_yes');
    expect(yes.answer).toBe(true);
    expect(no.status).toBe('valid_no');
    expect(no.answer).toBe(false);
  });

  it('flags invalid and incomplete filings', () => {
    const invalid = validateFiling(syntheticFilings[3]);
    const incomplete = validateFiling(syntheticFilings[4]);

    expect(invalid.valid).toBe(false);
    expect(incomplete.valid).toBe(false);
  });

  it('signs and verifies a DOF manifest', () => {
    const keys = ensureIssuerKeys();
    const filing = syntheticFilings[0];
    const salt = createSalt();
    const manifest = generateManifest(filing, salt, keys.privateKeyPem);
    expect(verifyManifestSignature(manifest, keys.publicKeyPem)).toBe(true);
    expect(manifest.commitment).toMatch(/^[a-f0-9]{64}$/);
  });
});
