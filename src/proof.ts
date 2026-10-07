import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';

import { APPROVED_THRESHOLD, computeSaltedCommitment, type Filing, validateFiling } from './filings.js';

const execFileAsync = promisify(execFile);

export type ThresholdProofResult = {
  status: 'verified' | 'failed_verification' | 'missing_data';
  proofPath?: string;
  verificationKeyPath?: string;
  publicInputs?: string[];
  message: string;
  error?: string;
};

function locateExecutable(...names: string[]): string | undefined {
  for (const candidate of names) {
    if (!candidate) continue;
    const binary = candidate;
    try {
      const fs = require('node:fs');
      if (fs.existsSync(binary)) return binary;
    } catch {
      // ignore
    }
  }

  for (const base of [process.env.PATH ?? '', '/home/runner/.cargo/bin', '/home/runner/work/housingproof/housingproof/node_modules/.bin']) {
    if (!base) continue;
    for (const name of names) {
      const path = join(base, name);
      try {
        const fs = require('node:fs');
        if (fs.existsSync(path)) return path;
      } catch {
        // ignore
      }
    }
  }

  return undefined;
}

export async function generateThresholdProof(filing: Filing, answer: boolean): Promise<ThresholdProofResult> {
  const validation = validateFiling(filing);
  if (!validation.valid) {
    return { status: 'missing_data', message: validation.errors.join('; ') || 'Missing filing data', error: 'filing invalid' };
  }

  const circuitDir = join(process.cwd(), 'circuits', 'threshold_question');
  const nargoBin = locateExecutable('nargo');
  const bbBin = locateExecutable('bb', join(process.cwd(), 'node_modules', '.bin', 'bb'));

  if (!nargoBin) {
    return { status: 'failed_verification', message: 'No Noir CLI installed', error: 'nargo_missing' };
  }

  if (!bbBin) {
    return { status: 'failed_verification', message: 'No Barretenberg binary available', error: 'bb_missing' };
  }

  const regulatedUnits = filing.unitCounts.regulatedResidentialUnits ?? 0;
  const threshold = APPROVED_THRESHOLD;
  const expected = answer ? regulatedUnits >= threshold : regulatedUnits < threshold;
  if (!expected) {
    return { status: 'failed_verification', message: 'The supplied answer does not match the filing data.', error: 'answer_mismatch' };
  }

  const salt = randomBytes(16).toString('hex');
  const commitment = computeSaltedCommitment(filing, salt);
  const witnessPath = join(circuitDir, 'Prover.toml');
  const proofDir = join(process.cwd(), 'proof-artifacts');
  mkdirSync(proofDir, { recursive: true });

  try {
    writeFileSync(
      witnessPath,
      `regulated_units = ${regulatedUnits}\nthreshold = ${threshold}\nsalt = "${salt}"\ncommitment = ${commitment}\n`,
      'utf8',
    );

    await execFileAsync(nargoBin, ['compile', '--force', '--package', 'threshold_question'], { cwd: circuitDir, env: process.env });
    await execFileAsync(nargoBin, ['execute', '--force', '--package', 'threshold_question'], { cwd: circuitDir, env: process.env });

    const outputBase = join(proofDir, 'threshold-proof');
    const crsPath = join(process.cwd(), '.bb-crs');
    mkdirSync(crsPath, { recursive: true });

    await execFileAsync(
      bbBin,
      [
        'prove',
        '-b',
        join(circuitDir, 'target', 'threshold_question.json'),
        '-w',
        join(circuitDir, 'target', 'threshold_question.gz'),
        '-o',
        outputBase,
        '-k',
        join(proofDir, 'threshold-vk.bin'),
        '--write_vk',
        '--output_format',
        'binary',
        '--verify',
        '--verifier_target',
        'noir-recursive',
        '-c',
        crsPath,
      ],
      { cwd: process.cwd(), env: { ...process.env, CRS_PATH: crsPath } },
    );

    return {
      status: 'verified',
      proofPath: `${outputBase}.proof`,
      verificationKeyPath: join(proofDir, 'threshold-vk.bin'),
      publicInputs: [String(answer ? 1 : 0)],
      message: 'Proof generation succeeded against the threshold circuit.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed_verification',
      message: 'The proof system could not complete verification in this environment because the Barretenberg CRS is unavailable.',
      error: message,
    };
  }
}
