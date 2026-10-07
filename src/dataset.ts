import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const syntheticFilings: unknown[] = JSON.parse(readFileSync(fileURLToPath(new URL('../data/filings.json', import.meta.url)), 'utf8'));
