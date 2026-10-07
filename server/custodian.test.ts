import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './custodian.js';
import { APPROVED_QUESTION } from '../src/filings.js';

let server: Server, base: string;
const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keys = { privateKeyPem: keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), publicKeyPem: keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
beforeEach(async () => {
  server = createApp({ keys }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local test port');
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('custodian boundary', () => {
  it('rejects invalid registration, preserves a registered commitment, and never publishes salt', async () => {
    const invalid = await post('/api/filings/register', { filingId: 'DEMO-RPIE-001-2025-INVALID' });
    expect(invalid.status).toBe(422);
    const first = await (await post('/api/filings/register', { filingId: 'DEMO-RPIE-001-2025-BASE' })).json();
    const second = await (await post('/api/filings/register', { filingId: 'DEMO-RPIE-001-2025-BASE' })).json();
    expect(first.commitment).toBe(second.commitment);
    expect(JSON.stringify(first)).not.toMatch(/salt|insurance|regulated_units_reported/);
  });
  it('requires registration and denies changed thresholds', async () => {
    const unregistered = await post('/api/filings/answer', { filingId: 'DEMO-RPIE-001-2025-BASE', question: APPROVED_QUESTION });
    expect(unregistered.status).toBe(409);
    const denied = await post('/api/filings/answer', { filingId: 'DEMO-RPIE-001-2025-BASE', question: APPROVED_QUESTION, threshold: 19 });
    expect(denied.status).toBe(403);
  });
  it('withholds the Boolean and bundle when proving is unavailable', async () => {
    await post('/api/filings/register', { filingId: 'DEMO-RPIE-001-2025-BASE' });
    const response = await post('/api/filings/answer', { filingId: 'DEMO-RPIE-001-2025-BASE', question: APPROVED_QUESTION });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'service_unavailable', answer: null, bundle: null, verification: 'not_run' });
  });
  it('returns only source metadata to the agency source list', async () => {
    const sources = await (await fetch(`${base}/api/filings`)).json();
    expect(sources).toHaveLength(10);
    expect(Object.keys(sources[0]).sort()).toEqual(['id', 'label', 'propertyId', 'registered', 'reportingPeriod'].sort());
  });
});
