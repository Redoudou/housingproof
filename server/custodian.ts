import express from 'express';
import rateLimit from 'express-rate-limit';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { syntheticFilings } from '../src/dataset.js';
import { createSalt, ensureIssuerKeys, generateManifest, validateFiling, type Filing } from '../src/filings.js';
import { approvedPolicy, POLICIES } from '../src/policy.js';
import { generateProof, type Registration, type ProofResult } from '../src/proof.js';
import { verifyAnswerBundle } from '../src/bundle.js';
export function createApp(options: { filings?: unknown[]; keys?: { privateKeyPem: string; publicKeyPem: string }; prove?: typeof generateProof } = {}) {
  const app = express();
  const filings = structuredClone(options.filings ?? syntheticFilings);
  const keys = options.keys ?? ensureIssuerKeys();
  const prove = options.prove ?? generateProof;
  const registrations = new Map<string, Registration>();
  let busy = false;
  // Bounded in-memory audit log; synthetic recipient only. Resets on process restart.
  const disclosures: { recipient: string; sourceIds: string[]; predicateId: string; status: string; timestamp: string }[] = [];
  const record = (sourceIds: string[], predicateId: string, status: string) => {
    disclosures.push({ recipient: 'simulated-agency', sourceIds, predicateId, status, timestamp: new Date().toISOString() });
    if (disclosures.length > 1000) disclosures.shift();
  };
  const findFiling = (id: string): unknown => filings.find(value => value && typeof value === 'object' && (value as Filing).source_id === id);
  app.use(express.json({ limit: '128kb' }));
  app.use('/api/', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.get('/api/questions', (_req, res) => res.json(Object.values(POLICIES)));
  app.get('/api/trust/issuer', (_req, res) => res.type('text/plain').send(keys.publicKeyPem));
  app.get('/api/disclosures', (_req, res) => res.json(disclosures));
  // Both roles share a loopback simulation; not production identity/access control.
  app.get('/api/filings', (_req, res) => {
    res.json(filings.map(value => {
      const f = value as Filing;
      return { id: f.source_id, label: f.source_id, propertyId: f.property.property_id,
        reportingPeriod: String(f.reporting_period.year), registered: registrations.has(f.source_id) };
    }));
  });
  app.post('/api/filings/register', (req, res) => {
    const id = req.body?.filingId;
    if (typeof id !== 'string') { res.status(400).json({ status: 'missing_data', message: 'Choose a synthetic filing.' }); return; }
    const candidate = findFiling(id);
    if (!candidate) { res.status(404).json({ status: 'missing_data', message: 'Unknown source.' }); return; }
    if (!validateFiling(candidate).valid) { res.status(422).json({ status: 'missing_data', message: 'Registration rejected: invalid or incomplete filing.' }); return; }
    const filing = candidate as Filing;
    let registration = registrations.get(id);
    if (!registration) {
      const salt = createSalt(); registration = { filing, salt, manifest: generateManifest(filing, salt, keys.privateKeyPem) };
      registrations.set(id, registration);
    }
    const manifest = registration.manifest;
    res.json({ filingId: id, propertyId: manifest.propertyId, commitment: manifest.commitment, manifest, sourceStatus: 'registered_simulation' });
  });
  app.post('/api/filings/answer', async (req, res) => {
    const id = req.body?.filingId, priorId = req.body?.priorFilingId;
    const threshold = req.body?.threshold ?? 20;
    const p = approvedPolicy(req.body?.question, threshold);
    const noAnswer = (status: string, message: string) => ({ status, answer: null, verification: 'not_run', message, bundle: null });
    if (!p) { record([], 'unapproved', 'denied'); res.status(403).json(noAnswer('denied', 'Only the two fixed catalog questions and thresholds are approved.')); return; }
    const current = typeof id === 'string' ? registrations.get(id) : undefined;
    const prior = typeof priorId === 'string' ? registrations.get(priorId) : undefined;
    if (!current) { res.status(409).json(noAnswer('not_registered', 'Register a valid synthetic current filing first.')); return; }
    if (p.id === 'Q002' && !prior) { res.status(422).json(noAnswer('missing_data', 'Register and select a comparable prior-year filing.')); return; }
    if (busy) { res.status(503).json(noAnswer('service_unavailable', 'The proof service is busy. Try again when the current proof finishes.')); return; }
    busy = true;
    const sourceIds = [id, ...(p.id === 'Q002' ? [priorId] : [])];
    try {
      const proof: ProofResult = await prove(p.id, current, prior);
      if (proof.status !== 'proved') {
        record(sourceIds, p.id, proof.status);
        res.status(proof.status === 'service_unavailable' ? 503 : 422).json(noAnswer(proof.status, proof.message)); return;
      }
      const verification = await verifyAnswerBundle(proof.bundle, keys.publicKeyPem);
      if (!verification.verified) {
        record(sourceIds, p.id, verification.status);
        res.status(verification.status === 'service_unavailable' ? 503 : 422).json(noAnswer(verification.status, verification.reason)); return;
      }
      record(sourceIds, p.id, verification.status);
      res.json({ filingId: id, status: verification.status, answer: proof.bundle.answer, verification: 'verified',
        message: verification.reason, bundle: proof.bundle, provingMs: proof.provingMs, proofBytes: proof.proofBytes });
    } catch {
      record(sourceIds, p.id, 'service_unavailable');
      res.status(503).json(noAnswer('service_unavailable', 'Proof service failed. No answer released.'));
    } finally { busy = false; }
  });
  app.post('/api/verify', async (req, res) => {
    if (busy) { res.status(503).json({ verified: false, status: 'service_unavailable', reason: 'Proof service busy. Try again shortly.' }); return; }
    busy = true;
    try {
      const result = await verifyAnswerBundle(req.body, keys.publicKeyPem);
      res.status(result.verified ? 200 : result.status === 'rejected' ? 422 : 503).json(result);
    } catch { res.status(503).json({ verified: false, status: 'service_unavailable', reason: 'Verification service unavailable.' }); }
    finally { busy = false; }
  });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error instanceof SyntaxError ? 400 : 500).json({ status: 'rejected', message: 'Malformed request or service failure. No answer released.' });
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, '127.0.0.1', () => console.log(`Housingproof local simulation: http://localhost:${port}`));
}
