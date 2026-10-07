import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { APPROVED_QUESTION, APPROVED_THRESHOLD, evaluateThreshold, syntheticFilings } from '../src/filings.js';

const outputDir = join(process.cwd(), 'proof-artifacts');
mkdirSync(outputDir, { recursive: true });

const summary = syntheticFilings.map((filing) => ({
  id: filing.id,
  result: evaluateThreshold(filing, APPROVED_QUESTION),
  threshold: APPROVED_THRESHOLD,
  question: APPROVED_QUESTION,
}));

writeFileSync(join(outputDir, 'demo-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`Wrote ${join(outputDir, 'demo-summary.json')}`);
