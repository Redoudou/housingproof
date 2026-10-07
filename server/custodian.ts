import express from 'express';
import rateLimit from 'express-rate-limit';
import { pathToFileURL } from 'node:url';
import { APPROVED_QUESTION, APPROVED_THRESHOLD, createSalt, ensureIssuerKeys, evaluateThreshold, generateManifest, syntheticFilings, validateFiling, type Filing, type Manifest } from '../src/filings.js';
import { generateThresholdProof } from '../src/proof.js';

export function createApp(options: { filings?: unknown[]; keys?: { privateKeyPem: string; publicKeyPem: string } } = {}) {
  const app = express();
  const filings = options.filings ?? syntheticFilings;
  const keys = options.keys ?? ensureIssuerKeys();
  const registrations = new Map<string, { manifest: Manifest; salt: string; filing: Filing }>();
  const findFiling = (id: string): unknown => filings.find((value) => value && typeof value === 'object' && (value as Filing).source_id === id);
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  app.use(express.static('public'));

  // Both roles share a local simulation. This is not production authentication or isolation.
  app.get('/api/filings', (_req, res) => {
    res.json(filings.map((value) => {
      const filing = value as Filing;
      return { id: filing.source_id, label: filing.source_id, propertyId: filing.property.property_id,
        reportingPeriod: String(filing.reporting_period.year), registered: registrations.has(filing.source_id) };
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
      const salt = createSalt();
      registration = { filing, salt, manifest: generateManifest(filing, salt, keys.privateKeyPem) };
      registrations.set(id, registration);
    }
    const manifest = registration.manifest;
    res.json({ filingId: id, propertyId: manifest.propertyId, commitment: manifest.commitment, manifest, sourceStatus: 'registered_simulation' });
  });
  app.post('/api/filings/answer', async (req, res) => {
    const id = req.body?.filingId;
    const question = req.body?.question;
    const threshold = req.body?.threshold ?? APPROVED_THRESHOLD;
    const policy = evaluateThreshold(null, question, threshold);
    if (policy.status === 'denied') { res.status(403).json({ status: 'denied', answer: null, verification: 'not_run', message: policy.message, bundle: null }); return; }
    const registered = typeof id === 'string' ? registrations.get(id) : undefined;
    if (!registered) { res.status(409).json({ status: 'not_registered', answer: null, verification: 'not_run', message: 'Register a valid synthetic filing in the DOF simulation first.', bundle: null }); return; }
    const outcome = evaluateThreshold(registered.filing, question, threshold);
    const proof = await generateThresholdProof(registered.filing, outcome.answer === true, registered.manifest, registered.salt);
    res.status(503).json({ filingId: id, question: APPROVED_QUESTION, threshold: APPROVED_THRESHOLD,
      status: proof.status, answer: null, verification: 'not_run', message: proof.message, bundle: null });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, '127.0.0.1', () => console.log(`Housingproof local simulation: http://localhost:${port}`));
}
