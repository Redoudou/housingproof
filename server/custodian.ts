import cors from 'cors';
import express from 'express';
import { ensureIssuerKeys, evaluateThreshold, exportBundle, generateManifest, loadPrivateKeyPem, loadPublicKeyPem, syntheticFilings, verifyManifestSignature, createSalt, type Manifest, type Filing, APPROVED_QUESTION, APPROVED_THRESHOLD } from '../src/filings.js';
import { generateThresholdProof } from '../src/proof.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const registrations = new Map<string, { manifest: Manifest; salt: string }>();

ensureIssuerKeys();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/filings', (_req, res) => {
  const list = syntheticFilings.map((filing) => ({
    id: filing.id,
    label: `${filing.id} (${filing.status})`,
    status: filing.status,
    propertyId: filing.propertyId,
    reportingPeriod: filing.reportingPeriod,
  }));
  res.json(list);
});

app.post('/api/filings/register', (req, res) => {
  const filingId = String(req.body?.filingId ?? '');
  const filing = syntheticFilings.find((entry) => entry.id === filingId);

  if (!filing) {
    res.status(404).json({ error: 'Unknown filing id' });
    return;
  }

  const salt = createSalt();
  const manifest = generateManifest(filing, salt, loadPrivateKeyPem());
  registrations.set(filing.id, { manifest, salt });

  res.json({
    filingId: filing.id,
    propertyId: filing.propertyId,
    commitment: manifest.commitment,
    manifest,
    verification: verifyManifestSignature(manifest, loadPublicKeyPem()) ? 'valid' : 'invalid',
  });
});

app.post('/api/filings/answer', async (req, res) => {
  const filingId = String(req.body?.filingId ?? '');
  const question = String(req.body?.question ?? '');
  const filing = syntheticFilings.find((entry) => entry.id === filingId);

  if (!filing) {
    res.status(404).json({ error: 'Unknown filing id' });
    return;
  }

  const outcome = evaluateThreshold(filing, question);
  const registered = registrations.get(filing.id);
  const manifest = registered?.manifest ?? generateManifest(filing, registered?.salt ?? createSalt(), loadPrivateKeyPem());

  let bundle: Record<string, unknown> | null = null;
  let verification = 'not_run';

  if (outcome.status === 'valid_yes' || outcome.status === 'valid_no') {
    const proofResult = await generateThresholdProof(filing, outcome.answer === true);
    verification = proofResult.status === 'verified' ? 'valid' : 'failed_verification';
    if (proofResult.status === 'verified') {
      bundle = exportBundle(outcome, filing, manifest);
      (bundle as any).proof = proofResult;
    }
  } else if (outcome.status === 'missing_data') {
    verification = 'missing_data';
  } else {
    verification = 'denied';
  }

  res.json({
    filingId: filing.id,
    question: APPROVED_QUESTION,
    threshold: APPROVED_THRESHOLD,
    status: outcome.status,
    answer: outcome.answer,
    verification,
    message: outcome.message,
    bundle,
  });
});

app.listen(PORT, () => {
  console.log(`Housingproof custodian listening on http://localhost:${PORT}`);
});
