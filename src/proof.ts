import { validateFiling, type Filing, type Manifest } from './filings.js';

export type ThresholdProofResult = { status: 'service_unavailable' | 'missing_data'; message: string };

// The starter circuit uses an arithmetic commitment, while ingestion uses SHA-256.
// They are different statements. Keep this path disabled until the circuit,
// canonical encoding, public inputs, trusted VK, and backend pass end-to-end tests.
export async function generateThresholdProof(filing: Filing, _answer: boolean, _manifest: Manifest, _privateSalt: string): Promise<ThresholdProofResult> {
  if (!validateFiling(filing).valid) return { status: 'missing_data', message: 'The filing is invalid or incomplete.' };
  return { status: 'service_unavailable', message: 'Real ZK proof generation is not ready. Shared commitment encoding and a compatible pinned toolchain must be implemented and tested. No verified answer is available.' };
}
