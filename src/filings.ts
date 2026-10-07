import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { APPROVED_QUESTION, APPROVED_THRESHOLD, SCHEMA_VERSION, COMMITMENT_ENCODING, EXPENSE_KEYS } from './policy.js';
import { computeSaltedCommitment } from './commitment.js';
export { APPROVED_QUESTION, APPROVED_THRESHOLD, PREDICATE_ID, SCHEMA_VERSION, COMMITMENT_ENCODING, EXPENSE_KEYS } from './policy.js';
export { computeSaltedCommitment } from './commitment.js';
export type Filing = {
  schema_version: typeof SCHEMA_VERSION;
  synthetic: true;
  source_id: string;
  source_revision: number;
  property: { property_id: string; residential_units: number; commercial_units: 0; owner_occupied_units: 0 };
  reporting_period: { year: 2024 | 2025; basis: 'calendar'; start: string; end: string };
  scope: { projection: 'residential-only-main-statement-v1'; other_income_categories_present: false; replacement_reserve_activity_present: false; rent_roll_included: false };
  income: { regulated_units_reported: number; unregulated_units_reported: number; regulated_rental_income_cents: number; unregulated_rental_income_cents: number; other_service_income_cents: number };
  operating_expenses_cents: Record<typeof EXPENSE_KEYS[number], number>;
  excluded_expenses_cents: { real_estate_taxes: number; bad_debt: number; depreciation: number; mortgage_interest: number };
};
export type Manifest = {
  issuer: 'NYC-DOF-simulated'; sourceId: string; propertyId: string; reportingPeriod: string;
  schemaVersion: string; sourceRevision: number; commitmentEncoding: typeof COMMITMENT_ENCODING;
  commitment: string; rawDigest: string; issuedOn: string; signature: string;
};
export type ValidationResult = { valid: boolean; errors: string[] };
let filingSchema: Schema | undefined;
type Schema = { type?: string; const?: unknown; enum?: unknown[]; minimum?: number; maximum?: number; pattern?: string; format?: string; required?: string[]; properties?: Record<string, Schema>; additionalProperties?: boolean };

export function canonicalizeFiling(value: unknown): string {
  return JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
}

// Supports the finite keyword set used in our checked-in schema. Not a general JSON Schema engine.
function checkSchema(value: unknown, schema: Schema, path: string, errors: string[]): void {
  if ('const' in schema && value !== schema.const) errors.push(`${path}: wrong constant`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: value outside enum`);
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${path}: expected object`); return; }
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in record)) errors.push(`${path}.${key}: required`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (key in record) checkSchema(record[key], child, `${path}.${key}`, errors);
    if (schema.additionalProperties === false) for (const key of Object.keys(record)) if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key}: unsupported field`);
  } else if (schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) { errors.push(`${path}: expected safe integer`); return; }
    if (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: out of range`);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') { errors.push(`${path}: expected string`); return; }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: invalid format`);
    if (schema.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors.push(`${path}: invalid date`);
  }
}

export function validateFiling(value: unknown): ValidationResult {
  const errors: string[] = [];
  filingSchema ??= JSON.parse(readFileSync(new URL('../data/schema.json', import.meta.url), 'utf8'));
  checkSchema(value, filingSchema!, '$', errors);
  if (!errors.length) {
    const filing = value as Filing;
    const { year, start, end } = filing.reporting_period;
    if (start !== `${year}-01-01` || end !== `${year}-12-31`) errors.push('Only full calendar-year filings are supported');
    if (filing.income.regulated_units_reported + filing.income.unregulated_units_reported !== filing.property.residential_units) errors.push('Reported residential counts must reconcile for this subset');
    if (filing.property.residential_units < 1) errors.push('Residential capacity must be positive');
  }
  return { valid: !errors.length, errors };
}

export function isApprovedQuestion(question: unknown): boolean {
  return typeof question === 'string' && question.replace(/\s+/g, ' ').trim() === APPROVED_QUESTION;
}

export function createSalt(): string { return randomBytes(32).toString('hex'); }
export function getKeyDirectory(): string {
  const dir = join(process.cwd(), 'server', 'keys'); mkdirSync(dir, { recursive: true, mode: 0o700 }); return dir;
}
export function ensureIssuerKeys(): { privateKeyPem: string; publicKeyPem: string } {
  const dir = getKeyDirectory();
  const privatePath = join(dir, 'issuer-private.pem'), publicPath = join(dir, 'issuer-public.pem');
  if (existsSync(privatePath) !== existsSync(publicPath)) throw new Error('Incomplete issuer key pair; do not silently rotate keys');
  if (existsSync(privatePath)) return { privateKeyPem: readFileSync(privatePath, 'utf8'), publicKeyPem: readFileSync(publicPath, 'utf8') };
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  writeFileSync(privatePath, privateKeyPem, { mode: 0o600 }); writeFileSync(publicPath, publicKeyPem, { mode: 0o644 });
  return { privateKeyPem, publicKeyPem };
}
export function generateManifest(filing: Filing, salt: string, privateKeyPem: string): Manifest {
  const validation = validateFiling(filing);
  if (!validation.valid) throw new Error('Cannot register invalid or incomplete filing');
  const payload = { issuer: 'NYC-DOF-simulated' as const, sourceId: filing.source_id,
    propertyId: filing.property.property_id, reportingPeriod: String(filing.reporting_period.year),
    schemaVersion: filing.schema_version, sourceRevision: filing.source_revision,
    commitmentEncoding: COMMITMENT_ENCODING as typeof COMMITMENT_ENCODING, commitment: computeSaltedCommitment(filing, salt),
    rawDigest: createHash('sha256').update('housingproof:source-record:v1\n').update(Buffer.from(salt, 'hex')).update(JSON.stringify(filing)).digest('hex'), issuedOn: new Date().toISOString() };
  return { ...payload, signature: sign('RSA-SHA256', Buffer.from(canonicalizeFiling(payload)), createPrivateKey(privateKeyPem)).toString('base64') };
}
export function verifyManifestSignature(manifest: Manifest, publicKeyPem: string): boolean {
  try {
    const keys = ['issuer', 'sourceId', 'propertyId', 'reportingPeriod', 'schemaVersion', 'sourceRevision', 'commitmentEncoding', 'commitment', 'rawDigest', 'issuedOn', 'signature'];
    if (!manifest || Object.keys(manifest).sort().join(',') !== keys.sort().join(',')
      || typeof manifest.sourceId !== 'string' || !/^DEMO-RPIE-[A-Z0-9-]+$/.test(manifest.sourceId)
      || typeof manifest.propertyId !== 'string' || !/^DEMO-RPIE-[A-Z0-9-]+$/.test(manifest.propertyId)
      || !['2024', '2025'].includes(manifest.reportingPeriod) || !Number.isInteger(manifest.sourceRevision) || manifest.sourceRevision < 1 || manifest.sourceRevision > 1000000
      || typeof manifest.issuedOn !== 'string' || !Number.isFinite(Date.parse(manifest.issuedOn)) || typeof manifest.signature !== 'string') return false;
    if (manifest.issuer !== 'NYC-DOF-simulated' || manifest.schemaVersion !== SCHEMA_VERSION || manifest.commitmentEncoding !== COMMITMENT_ENCODING
      || !/^[a-f0-9]{64}$/.test(manifest.commitment) || !/^[a-f0-9]{64}$/.test(manifest.rawDigest) || 'salt' in manifest) return false;
    const { signature, ...payload } = manifest;
    return verify('RSA-SHA256', Buffer.from(canonicalizeFiling(payload)), createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'));
  } catch { return false; }
}
export function evaluateThreshold(value: unknown, question: unknown, threshold: unknown = APPROVED_THRESHOLD) {
  if (!isApprovedQuestion(question) || threshold !== APPROVED_THRESHOLD) return { status: 'denied' as const, answer: null, message: 'Only Q001 with threshold 20 is approved.' };
  if (!validateFiling(value).valid) return { status: 'missing_data' as const, answer: null, message: 'The filing is incomplete or invalid.' };
  const answer = (value as Filing).income.regulated_units_reported >= APPROVED_THRESHOLD;
  return { status: answer ? 'computed_yes' as const : 'computed_no' as const, answer, message: 'Local arithmetic result only; not cryptographically verified.' };
}
