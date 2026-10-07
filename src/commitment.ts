import { createHash } from 'node:crypto';
import { BarretenbergSync, Fr } from '@aztec/bb.js';
import type { Filing, Manifest } from './filings.js';
import { EXPENSE_KEYS, EXCLUDED_KEYS, POLICIES, type PredicateId } from './policy.js';
// Synchronous Poseidon2 calls after one public WASM initialization. No witness files.
const hashBackend = await BarretenbergSync.initSingleton();
export const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const identityHash = (kind: 'source' | 'property', value: string) => sha256(`housingproof:${kind}:v3\n${value}`);
export const field = (value: string | number | bigint | boolean) => `0x${BigInt(typeof value === 'boolean' ? Number(value) : value).toString(16).padStart(64, '0')}`;
const limbs = (hex: string) => [field('0x' + hex.slice(0, 32)), field('0x' + hex.slice(32))];
export function sourceInput(manifest: Manifest) {
  return { commitment: field('0x' + manifest.commitment), source_hash: limbs(identityHash('source', manifest.sourceId)),
    property_hash: limbs(identityHash('property', manifest.propertyId)), year: Number(manifest.reportingPeriod), revision: manifest.sourceRevision };
}
export function projectionInput(filing: Filing, salt: string) {
  return { residential: filing.property.residential_units, regulated: filing.income.regulated_units_reported,
    unregulated: filing.income.unregulated_units_reported,
    income: [filing.income.regulated_rental_income_cents, filing.income.unregulated_rental_income_cents, filing.income.other_service_income_cents],
    expenses: EXPENSE_KEYS.map(k => filing.operating_expenses_cents[k]), excluded: EXCLUDED_KEYS.map(k => filing.excluded_expenses_cents[k]), salt: limbs(salt) };
}
export function encodeProjection(filing: Filing, salt: string): string[] {
  if (!/^[a-f0-9]{64}$/.test(salt)) throw new Error('Commitment requires a private 32-byte salt');
  const v = projectionInput(filing, salt);
  return [field('0x' + Buffer.from('housingproof:v3:', 'ascii').toString('hex')), field(1), field(1),
    ...limbs(identityHash('source', filing.source_id)), ...limbs(identityHash('property', filing.property.property_id)),
    ...[filing.reporting_period.year, filing.source_revision, v.residential, v.regulated, v.unregulated, ...v.income, ...v.expenses, ...v.excluded].map(field), ...v.salt];
}
export const computeSaltedCommitment = (filing: Filing, salt: string) => hashBackend.poseidon2Hash(encodeProjection(filing, salt).map(x => new Fr(BigInt(x)))).toString().slice(2);
export function expectedPublicInputs(id: PredicateId, manifests: Manifest[], answer: boolean): string[] {
  const p = POLICIES[id];
  return [...manifests.flatMap(m => {
    const source = sourceInput(m);
    return [source.commitment, ...source.source_hash, ...source.property_hash, field(source.year), field(source.revision)];
  }), field(p.number), field(p.version), field(p.threshold), field(answer)];
}
