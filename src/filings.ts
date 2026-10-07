import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const APPROVED_QUESTION = 'Does this filing report at least 20 rent-regulated residential units?';
export const APPROVED_THRESHOLD = 20;
export const SCHEMA_VERSION = 'rpie-2025-residential-v1';

export type FilingStatus = 'valid' | 'invalid' | 'incomplete';

export type Filing = {
  id: string;
  propertyId: string;
  propertyType: 'residential';
  reportingPeriod: string;
  schemaVersion: string;
  sourceRevision: string;
  status: FilingStatus;
  unitCounts: {
    totalDwellingUnits: number;
    regulatedResidentialUnits: number | null;
    marketRateUnits: number | null;
    otherResidentialUnits: number | null;
  };
  annualIncomeCategories: {
    grossPotentialRent: number;
    vacancyAndCollectionLoss: number;
    netEffectiveGrossIncome: number;
    otherOperatingIncome: number;
    totalIncome: number;
  };
  operatingExpenses: {
    repairsAndMaintenance: number;
    utilities: number;
    insurance: number;
    taxesAndAssessments: number;
    management: number;
    otherOperatingExpenses: number;
    totalOperatingExpenses: number;
  };
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export type Manifest = {
  issuer: 'NYC-DOF-simulated';
  propertyId: string;
  reportingPeriod: string;
  schemaVersion: string;
  sourceRevision: string;
  commitment: string;
  salt: string;
  issuedOn: string;
  signature: string;
};

export const syntheticFilings: Filing[] = JSON.parse(readFileSync(join(process.cwd(), 'data', 'filings.json'), 'utf8')) as Filing[];

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)));
    }
    return item;
  });
}

export function canonicalizeFiling(filing: Partial<Filing>): string {
  return stableStringify(filing);
}

export function validateFiling(filing: Partial<Filing>): ValidationResult {
  const errors: string[] = [];
  if (!filing.propertyId) errors.push('propertyId is required');
  if (!filing.reportingPeriod) errors.push('reportingPeriod is required');
  if (!filing.schemaVersion) errors.push('schemaVersion is required');

  const totalUnits = filing.unitCounts?.totalDwellingUnits;
  const regulatedUnits = filing.unitCounts?.regulatedResidentialUnits;

  if (typeof totalUnits !== 'number' || totalUnits <= 0 || !Number.isInteger(totalUnits)) {
    errors.push('totalDwellingUnits must be a positive integer');
  }

  if (typeof regulatedUnits !== 'number' || !Number.isInteger(regulatedUnits) || regulatedUnits < 0) {
    errors.push('regulatedResidentialUnits must be a non-negative integer');
  }

  if (typeof totalUnits === 'number' && typeof regulatedUnits === 'number' && regulatedUnits > totalUnits) {
    errors.push('regulatedResidentialUnits cannot exceed totalDwellingUnits');
  }

  const marketRateUnits = filing.unitCounts?.marketRateUnits;
  if (marketRateUnits !== null && marketRateUnits !== undefined && typeof marketRateUnits !== 'number') {
    errors.push('marketRateUnits must be a number or null');
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeQuestion(question: string): string {
  return question.replace(/\s+/g, ' ').trim();
}

export function isApprovedQuestion(question: string): boolean {
  return normalizeQuestion(question) === APPROVED_QUESTION;
}

export function computeSaltedCommitment(filing: Filing, salt: string): string {
  const canonical = canonicalizeFiling({
    propertyId: filing.propertyId,
    reportingPeriod: filing.reportingPeriod,
    schemaVersion: filing.schemaVersion,
    sourceRevision: filing.sourceRevision,
    unitCounts: filing.unitCounts,
  });
  return createHash('sha256').update(`${canonical}|${salt}`).digest('hex');
}

export function createSalt(): string {
  return randomBytes(16).toString('hex');
}

export function getKeyDirectory(): string {
  const dir = join(process.cwd(), 'server', 'keys');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureIssuerKeys(): { privateKeyPem: string; publicKeyPem: string } {
  const dir = getKeyDirectory();
  const privatePath = join(dir, 'issuer-private.pem');
  const publicPath = join(dir, 'issuer-public.pem');

  if (existsSync(privatePath) && existsSync(publicPath)) {
    return {
      privateKeyPem: readFileSync(privatePath, 'utf8'),
      publicKeyPem: readFileSync(publicPath, 'utf8'),
    };
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  writeFileSync(privatePath, privatePem, 'utf8');
  writeFileSync(publicPath, publicPem, 'utf8');

  return { privateKeyPem: privatePem, publicKeyPem: publicPem };
}

export function loadPublicKeyPem(): string {
  const keyPath = join(getKeyDirectory(), 'issuer-public.pem');
  return readFileSync(keyPath, 'utf8');
}

export function loadPrivateKeyPem(): string {
  const keyPath = join(getKeyDirectory(), 'issuer-private.pem');
  return readFileSync(keyPath, 'utf8');
}

export function generateManifest(filing: Filing, salt = createSalt(), privateKeyPem = loadPrivateKeyPem()): Manifest {
  const commitment = computeSaltedCommitment(filing, salt);
  const manifestPayload = {
    issuer: 'NYC-DOF-simulated' as const,
    propertyId: filing.propertyId,
    reportingPeriod: filing.reportingPeriod,
    schemaVersion: filing.schemaVersion,
    sourceRevision: filing.sourceRevision,
    commitment,
    salt,
    issuedOn: new Date().toISOString(),
  };

  const signature = sign('RSA-SHA256', Buffer.from(JSON.stringify(manifestPayload), 'utf8'), createPrivateKey(privateKeyPem)).toString('base64');

  return { ...manifestPayload, signature };
}

export function verifyManifestSignature(
  manifest: Pick<Manifest, 'issuer' | 'propertyId' | 'reportingPeriod' | 'schemaVersion' | 'sourceRevision' | 'commitment' | 'salt' | 'issuedOn' | 'signature'>,
  publicKeyPem: string,
): boolean {
  const payload = {
    issuer: manifest.issuer,
    propertyId: manifest.propertyId,
    reportingPeriod: manifest.reportingPeriod,
    schemaVersion: manifest.schemaVersion,
    sourceRevision: manifest.sourceRevision,
    commitment: manifest.commitment,
    salt: manifest.salt,
    issuedOn: manifest.issuedOn,
  };

  return verify(
    'RSA-SHA256',
    Buffer.from(JSON.stringify(payload), 'utf8'),
    createPublicKey(publicKeyPem),
    Buffer.from(manifest.signature, 'base64'),
  );
}

export function evaluateThreshold(
  filing: Filing,
  question: string,
): {
  status: 'valid_yes' | 'valid_no' | 'missing_data' | 'denied';
  answer: boolean | null;
  threshold: number;
  errors: string[];
  message: string;
} {
  if (!isApprovedQuestion(question)) {
    return {
      status: 'denied',
      answer: null,
      threshold: APPROVED_THRESHOLD,
      errors: ['Unsupported question'],
      message: 'Only the fixed approved question is supported in this milestone.',
    };
  }

  const validation = validateFiling(filing);
  if (!validation.valid) {
    return {
      status: 'missing_data',
      answer: null,
      threshold: APPROVED_THRESHOLD,
      errors: validation.errors,
      message: 'The filing is incomplete or invalid for the approved threshold question.',
    };
  }

  const regulatedUnits = filing.unitCounts.regulatedResidentialUnits ?? 0;
  const answer = regulatedUnits >= APPROVED_THRESHOLD;

  return {
    status: answer ? 'valid_yes' : 'valid_no',
    answer,
    threshold: APPROVED_THRESHOLD,
    errors: [],
    message: answer ? 'Verified positive threshold result.' : 'Verified negative threshold result.',
  };
}

export function exportBundle(
  answerOutcome: {
    status: 'valid_yes' | 'valid_no' | 'missing_data' | 'denied';
    answer: boolean | null;
    threshold: number;
    errors: string[];
    message: string;
  },
  filing: Filing,
  manifest: Manifest,
): Record<string, unknown> {
  return {
    version: 'housingproof-bundle-1',
    question: APPROVED_QUESTION,
    threshold: APPROVED_THRESHOLD,
    status: answerOutcome.status,
    answer: answerOutcome.answer,
    filingId: filing.id,
    propertyId: filing.propertyId,
    reportingPeriod: filing.reportingPeriod,
    schemaVersion: filing.schemaVersion,
    commitment: manifest.commitment,
    manifest,
    publicInputs: {
      threshold: APPROVED_THRESHOLD,
      commitment: manifest.commitment,
      answer: answerOutcome.answer,
    },
  };
}
