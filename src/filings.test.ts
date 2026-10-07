import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPROVED_QUESTION, computeSaltedCommitment, createSalt, evaluateThreshold, generateManifest, syntheticFilings, validateFiling, verifyManifestSignature, type Filing } from './filings.js';

const filing = (id: string): Filing => structuredClone(syntheticFilings.find((v) => (v as Filing).source_id === id)) as Filing;
export function testKeys() {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { privateKeyPem: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}
const keys = testKeys();

describe('source-mapped synthetic filing contract', () => {
  it('keeps every scenario source identical to the runtime dataset', () => {
    const bundle = JSON.parse(readFileSync('data/fixtures/demo-cases.json', 'utf8'));
    for (const expected of bundle.filings) expect(filing(expected.source_id)).toEqual(expected);
  });
  it.each([['BASE', true], ['EXACT-COUNT', true], ['BELOW-COUNT', false]])('computes Q001 for %s without calling it verified', (variant, answer) => {
    const result = evaluateThreshold(filing(`DEMO-RPIE-001-2025-${variant}`), APPROVED_QUESTION);
    expect(result.answer).toBe(answer);
    expect(result.status).toBe(answer ? 'computed_yes' : 'computed_no');
    expect(result.message).toContain('not cryptographically verified');
  });
  it.each(['INVALID', 'INCOMPLETE'])('rejects %s before signing', (variant) => {
    const f = filing(`DEMO-RPIE-001-2025-${variant}`);
    expect(validateFiling(f).valid).toBe(false);
    expect(() => generateManifest(f, createSalt(), keys.privateKeyPem)).toThrow();
    expect(evaluateThreshold(f, APPROVED_QUESTION).answer).toBeNull();
  });
  it('rejects missing expenses, unsupported schema, bad periods, fractional counts, and oversized amounts', () => {
    const base = filing('DEMO-RPIE-001-2025-BASE');
    const absent = structuredClone(base); delete (absent.operating_expenses_cents as Partial<Filing['operating_expenses_cents']>).insurance;
    const schema = { ...base, schema_version: 'untrusted' };
    const period = { ...base, reporting_period: { ...base.reporting_period, start: '2025-02-01' } };
    const fractional = { ...base, income: { ...base.income, regulated_units_reported: 20.5 } };
    const huge = { ...base, income: { ...base.income, other_service_income_cents: 10 ** 12 + 1 } };
    for (const f of [absent, schema, period, fractional, huge]) expect(validateFiling(f).valid).toBe(false);
  });
  it('denies changed questions and requester thresholds', () => {
    const f = filing('DEMO-RPIE-001-2025-BASE');
    expect(evaluateThreshold(f, 'Anything else').status).toBe('denied');
    expect(evaluateThreshold(f, APPROVED_QUESTION, 19).status).toBe('denied');
  });
  it('commits income, expenses, periods, and revisions as well as unit counts', () => {
    const f = filing('DEMO-RPIE-001-2025-BASE'), salt = createSalt();
    const committed = computeSaltedCommitment(f, salt);
    const variants = [structuredClone(f), structuredClone(f), structuredClone(f)];
    variants[0].operating_expenses_cents.insurance++;
    variants[1].income.other_service_income_cents++;
    variants[2].source_revision++;
    for (const value of variants) expect(computeSaltedCommitment(value, salt)).not.toBe(committed);
    expect(computeSaltedCommitment(f, createSalt())).not.toBe(committed);
  });
  it('signs simulated provenance, keeps salt private, and rejects changed sources or issuer keys', () => {
    const f = filing('DEMO-RPIE-001-2025-BASE'), salt = createSalt();
    const manifest = generateManifest(f, salt, keys.privateKeyPem);
    expect(verifyManifestSignature(manifest, keys.publicKeyPem)).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain(salt);
    expect(manifest).not.toHaveProperty('salt');
    expect(verifyManifestSignature({ ...manifest, sourceRevision: 2 }, keys.publicKeyPem)).toBe(false);
    expect(verifyManifestSignature(manifest, testKeys().publicKeyPem)).toBe(false);
  });
});
