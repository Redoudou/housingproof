import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PredicateId } from './policy.js';
export type CircuitTrust = { artifactHash: string; verificationKeyHash: string };
export function trustedCircuit(id: PredicateId): CircuitTrust {
  return JSON.parse(readFileSync(new URL('../circuits/trust.json', import.meta.url), 'utf8')).circuits[id];
}
export function runProofWorker(request: Record<string, unknown>, timeoutMs = 180_000): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/proof-worker.mjs', import.meta.url))], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', settled = false;
    const stop = (reason: string) => { if (!settled) { settled = true; child.kill('SIGKILL'); reject(new Error(reason)); } };
    const timer = setTimeout(() => stop('Proof service timed out'), timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 1_000_000) stop('Oversized proof response'); });
    // Deliberately never forward backend diagnostics or private input to client/logs.
    child.stderr.on('data', () => {});
    child.on('error', () => stop('Proof worker could not start'));
    child.stdin.on('error', () => stop('Proof worker unavailable'));
    child.on('close', code => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const line = stdout.split('\n').find(x => x.startsWith('HOUSINGPROOF_RESULT='));
      if (code !== 0 || !line) { reject(new Error('Proof toolchain unavailable or witness rejected')); return; }
      try { resolve(JSON.parse(line.slice('HOUSINGPROOF_RESULT='.length))); } catch { reject(new Error('Malformed proof response')); }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
