import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadPublicKeyPem, verifyManifestSignature } from '../src/filings.js';

const bundlePath = process.argv[2] ?? join(process.cwd(), 'proof-artifacts', 'bundle.json');
const raw = JSON.parse(readFileSync(bundlePath, 'utf8')) as any;

if (!raw || !raw.manifest || !raw.publicInputs) {
  console.error('Bundle is missing required fields.');
  process.exit(1);
}

const ok = verifyManifestSignature(raw.manifest, loadPublicKeyPem());
if (!ok) {
  console.error('Bundle verification failed: bad issuer signature.');
  process.exit(1);
}

const thresholdMatches = Number(raw.threshold) === 20;
if (!thresholdMatches) {
  console.error('Bundle verification failed: mismatched threshold.');
  process.exit(1);
}

console.log(JSON.stringify({ verified: true, status: raw.status, answer: raw.answer, question: raw.question, threshold: raw.threshold }, null, 2));
