import { APPROVED_QUESTION, evaluateThreshold, syntheticFilings } from '../src/filings.js';

// A private, local fixture oracle. No files or proof bundles are exported.
console.log(JSON.stringify({ cryptographyTested: false, results: syntheticFilings.map((value) => ({
  sourceId: value && typeof value === 'object' ? (value as { source_id?: string }).source_id : null,
  result: evaluateThreshold(value, APPROVED_QUESTION),
})) }, null, 2));
