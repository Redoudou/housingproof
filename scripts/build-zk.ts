import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runProofWorker, type CircuitTrust } from '../src/zk-runtime.js';
const result = spawnSync(process.execPath, ['scripts/compile-circuits.mjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(1);
const circuits: Record<string, CircuitTrust> = {};
for (const id of ['Q001', 'Q002']) {
  const result = await runProofWorker({ id, operation: 'key' });
  circuits[id] = { artifactHash: result.artifactHash, verificationKeyHash: result.verificationKeyHash };
  console.log(`${id}: compiled circuit and verification key fingerprinted.`);
}
const trust = { compiler: '1.0.0-beta.3', backend: '0.82.2', scheme: 'ultraplonk', circuits };
if (process.argv.includes('--update-trust')) {
  writeFileSync('circuits/trust.json', JSON.stringify(trust, null, 2) + '\n');
  console.log('Updated trust fingerprints. Review this change before distribution.');
} else {
  if (!existsSync('circuits/trust.json') || JSON.stringify(JSON.parse(readFileSync('circuits/trust.json', 'utf8'))) !== JSON.stringify(trust)) throw new Error('Circuit or VK differs from pinned trust. Refusing to proceed.');
  console.log('Compiled artifacts match pinned circuit and VK fingerprints.');
}
