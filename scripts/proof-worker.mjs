// Private witness arrives only on stdin. No shared witness files or private stdout.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Noir } from '@noir-lang/noir_js';
import { UltraPlonkBackend } from '@aztec/bb.js';
const digest = data => createHash('sha256').update(data).digest('hex');
let backend;
try {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const request = JSON.parse(input);
  if (!['Q001', 'Q002'].includes(request.id)) throw Error('Unknown circuit');
  const artifactText = readFileSync(new URL(`../proof-artifacts/${request.id}.json`, import.meta.url), 'utf8');
  const artifact = JSON.parse(artifactText);
  const trust = request.operation === 'key' ? undefined : JSON.parse(readFileSync(new URL('../circuits/trust.json', import.meta.url), 'utf8')).circuits[request.id];
  if (trust && digest(artifactText) !== trust.artifactHash) throw Error('Untrusted circuit artifact');
  backend = new UltraPlonkBackend(artifact.bytecode, { threads: 1 });
  const key = await backend.getVerificationKey();
  const keyHash = digest(key);
  if (trust && keyHash !== trust.verificationKeyHash) throw Error('Untrusted verification key');
  let result;
  if (request.operation === 'key') result = { artifactHash: digest(artifactText), verificationKeyHash: keyHash };
  else if (request.operation === 'prove') {
    const { witness } = await new Noir(artifact).execute(request.inputs);
    const started = performance.now();
    const proof = await backend.generateProof(witness);
    const verified = await backend.verifyProof(proof);
    if (!verified) throw Error('Fresh proof did not verify');
    result = { proof: Buffer.from(proof.proof).toString('base64'), publicInputs: proof.publicInputs, provingMs: Math.round(performance.now() - started), proofBytes: proof.proof.length };
  } else if (request.operation === 'verify') {
    try { result = { verified: await backend.verifyProof({ proof: Buffer.from(request.proof, 'base64'), publicInputs: request.publicInputs }) }; }
    catch { result = { verified: false }; }
  } else throw Error('Unknown operation');
  await backend.destroy(); backend = undefined;
  result.peakRssKb = process.resourceUsage().maxRSS;
  process.stdout.write('HOUSINGPROOF_RESULT=' + JSON.stringify(result) + '\n');
} catch {
  if (backend) await backend.destroy().catch(() => {});
  process.stderr.write('Proof operation failed. Check pinned artifacts, inputs, and tool availability.\n');
  process.exitCode = 1;
}
