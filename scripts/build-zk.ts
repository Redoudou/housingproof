import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runProofWorker, type CircuitTrust } from '../src/zk-runtime.js';
import { POLICIES } from '../src/policy.js';
const result = spawnSync(process.execPath, ['scripts/compile-circuits.mjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(1);
// Independent circuits: fingerprint them concurrently.
const circuits: Record<string, CircuitTrust> = Object.fromEntries(await Promise.all(Object.keys(POLICIES).map(async id => {
  const result = await runProofWorker({ id, operation: 'key' });
  console.log(`${id}: compiled circuit and verification key fingerprinted.`);
  return [id, { artifactHash: result.artifactHash, verificationKeyHash: result.verificationKeyHash }];
})));
const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8'));
const trust = { compiler: dependencies['@noir-lang/noir_js'], backend: dependencies['@aztec/bb.js'], scheme: 'ultraplonk', circuits };
if (process.argv.includes('--update-trust')) {
  writeFileSync('circuits/trust.json', JSON.stringify(trust, null, 2) + '\n');
  console.log('Updated trust fingerprints. Review this change before distribution.');
} else {
  if (!existsSync('circuits/trust.json') || JSON.stringify(JSON.parse(readFileSync('circuits/trust.json', 'utf8'))) !== JSON.stringify(trust)) throw new Error('Circuit or VK differs from pinned trust. Refusing to proceed.');
  console.log('Compiled artifacts match pinned circuit and VK fingerprints.');
}
