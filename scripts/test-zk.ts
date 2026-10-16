import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir, cpus, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Noir } from '@noir-lang/noir_js';
import { syntheticFilings } from '../src/dataset.js';
import { generateIssuerKeys, type Filing } from '../src/filings.js';
import { createRegistration, generateProof, answerFor } from '../src/proof.js';
import { verifyAnswerBundle, type AnswerBundle } from '../src/bundle.js';
import { POLICIES, type PredicateId } from '../src/policy.js';
import { sourceInput, projectionInput, computeSaltedCommitment } from '../src/commitment.js';
const { privateKeyPem: privateKey, publicKeyPem: publicKey } = generateIssuerKeys();
const register = (f: Filing) => createRegistration(f, privateKey);
const find = (suffix: string) => syntheticFilings.find(f => (f as Filing).source_id.endsWith(suffix)) as Filing;
console.log(syntheticFilings.map(f => (f as Filing).source_id).join('\n'));
const prior = register(find('2024-BASE'));
const report: unknown[] = [];
let firstBundle: AnswerBundle | undefined;
for (const [id, suffix, expected] of [
  ['Q001', '2025-BASE', true], ['Q001', '2025-EXACT-COUNT', true], ['Q001', '2025-BELOW-COUNT', false],
  ['Q002', '2025-BASE', false], ['Q002', '2025-STRESS', true], ['Q002', '2025-EXACT-DECLINE', false], ['Q002', '2025-NEGATIVE', true],
] as [PredicateId, string, boolean][]) {
  const current = register(find(suffix));
  assert.equal(answerFor(id, current.filing, prior.filing), expected);
  const start = performance.now();
  const result = await generateProof(id, current, id === 'Q002' ? prior : undefined);
  assert.equal(result.status, 'proved', JSON.stringify(result));
  if (result.status !== 'proved') throw Error('Proof failed');
  const verifyStart = performance.now();
  assert.equal((await verifyAnswerBundle(result.bundle, publicKey)).verified, true);
  report.push({ id, source: current.manifest.sourceId, answer: expected, proofBytes: result.proofBytes, peakRssKb: result.peakRssKb, generationMs: Math.round(verifyStart - start), verificationMs: Math.round(performance.now() - verifyStart) });
  writeFileSync('proof-artifacts/progress-benchmark.json', JSON.stringify(report, null, 2));
  console.log(`PASS real ${id} ${suffix}: ${expected ? 'YES' : 'NO'}`);
  assert.doesNotMatch(JSON.stringify(result.bundle), /salt|regulated_units_reported|income_cents|privateKey|witness/);
  if (!firstBundle) firstBundle = result.bundle;
}
assert(firstBundle);
for (const mutate of [
  (b: any) => { b.answer = !b.answer; }, (b: any) => { b.threshold = 19; },
  (b: any) => { b.manifests[0].reportingPeriod = '2024'; }, (b: any) => { b.manifests[0].sourceRevision++; },
  (b: any) => { b.manifests[0].commitment = '0'.repeat(64); }, (b: any) => { b.circuitId = 'arbitrary'; },
  (b: any) => { b.verificationKeyHash = '0'.repeat(64); }, (b: any) => { b.proof = ''; },
  (b: any) => { b.publicInputs[0] = '0x' + '00'.repeat(32); },
]) {
  const b: AnswerBundle = structuredClone(firstBundle); mutate(b);
  assert.equal((await verifyAnswerBundle(b, publicKey)).verified, false);
}
const unrelated = generateIssuerKeys().publicKeyPem;
assert.equal((await verifyAnswerBundle(firstBundle, unrelated)).verified, false);
const altered = structuredClone(firstBundle);
const bytes = Buffer.from(altered.proof, 'base64'); bytes[Math.floor(bytes.length / 2)] ^= 1; altered.proof = bytes.toString('base64');
assert.equal((await verifyAnswerBundle(altered, publicKey)).verified, false);
// Change both the answer and its public field: metadata checks pass, ZK must fail.
const changedAnswer = structuredClone(firstBundle); changedAnswer.answer = false;
changedAnswer.publicInputs[changedAnswer.publicInputs.length - 1] = '0x' + '00'.repeat(32);
assert.equal((await verifyAnswerBundle(changedAnswer, publicKey)).verified, false);
console.log('PASS bundle, proof, answer, source, policy, circuit and trust tampering');
const current = register(find('2025-BASE'));
const q = POLICIES.Q001;
const baseInputs = { source: sourceInput(current.manifest), values: projectionInput(current.filing, current.salt), predicate: q.number, version: q.version, threshold: q.threshold, answer: true };
const artifact = JSON.parse(readFileSync('proof-artifacts/Q001.json', 'utf8'));
for (const mutate of [
  (v: any) => { v.threshold = 19; }, (v: any) => { v.answer = false; }, (v: any) => { v.predicate = 2; },
  (v: any) => { v.values.salt[0] = '0x' + (BigInt(v.values.salt[0]) ^ 1n).toString(16).padStart(64, '0'); }, (v: any) => { v.values.income[0]++; },
  (v: any) => { v.values.regulated = 10001; }, (v: any) => { v.values.expenses[0] = 1000000000001; },
  (v: any) => { v.source.year = 2024; },
]) {
  const inputs = structuredClone(baseInputs); mutate(inputs);
  await assert.rejects(new Noir(artifact).execute(inputs));
}
assert.equal((await generateProof('Q002', current)).status, 'missing_data');
const zero = structuredClone(prior.filing); zero.income.regulated_rental_income_cents = 0; zero.income.unregulated_rental_income_cents = 0; zero.income.other_service_income_cents = 0;
assert.equal((await generateProof('Q002', current, register(zero))).status, 'missing_data');
const otherProperty = structuredClone(prior.filing); otherProperty.property.property_id = 'DEMO-RPIE-999';
assert.equal(answerFor('Q002', current.filing, otherProperty), null);
const q2artifact = JSON.parse(readFileSync('proof-artifacts/Q002.json', 'utf8'));
for (const changedPrior of [otherProperty, zero, structuredClone(current.filing)]) {
  const changedManifest = { ...prior.manifest, propertyId: changedPrior.property.property_id, reportingPeriod: String(changedPrior.reporting_period.year), sourceId: changedPrior.source_id, commitment: computeSaltedCommitment(changedPrior, prior.salt) };
  await assert.rejects(new Noir(q2artifact).execute({ current: sourceInput(current.manifest), prior: sourceInput(changedManifest), current_values: projectionInput(current.filing, current.salt), prior_values: projectionInput(changedPrior, prior.salt), predicate: POLICIES.Q002.number, version: POLICIES.Q002.version, threshold: POLICIES.Q002.threshold, answer: true }));
}
console.log('PASS private witness, cross-property, cross-year and positive-prior circuit constraints');
// Standalone verifier has no dataset, schema, issuer private key or server modules.
const isolated = mkdtempSync(resolve(tmpdir(), 'housingproof-verifier-'));
try {
  for (const path of ['src/bundle.ts', 'src/filings.ts', 'src/policy.ts', 'src/commitment.ts', 'src/zk-runtime.ts', 'scripts/verify-bundle.ts', 'scripts/proof-worker.mjs', 'circuits/trust.json', 'proof-artifacts/Q001.json', 'proof-artifacts/Q002.json']) {
    mkdirSync(resolve(isolated, path, '..'), { recursive: true }); cpSync(path, resolve(isolated, path));
  }
  writeFileSync(resolve(isolated, 'package.json'), '{"type":"module"}');
  symlinkSync(resolve('node_modules'), resolve(isolated, 'node_modules'), 'dir');
  writeFileSync(resolve(isolated, 'answer.json'), JSON.stringify(firstBundle));
  writeFileSync(resolve(isolated, 'issuer.pem'), publicKey);
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-bundle.ts', 'answer.json', 'issuer.pem'], { cwd: isolated, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /"verified": true/);
  console.log('PASS isolated CLI verification without source records or private key');
} finally { rmSync(isolated, { recursive: true, force: true }); }
writeFileSync('proof-artifacts/benchmark.json', JSON.stringify({ date: new Date().toISOString(), node: process.version, platform: process.platform, architecture: process.arch, cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(), tests: report }, null, 2));
console.log(JSON.stringify(report, null, 2));
