import { readFileSync } from 'node:fs';
import { verifyAnswerBundle } from '../src/bundle.js';

// The trust anchor comes from the verifier operator, never from the bundle or a private-key loader.
const [bundlePath, publicKeyPath] = process.argv.slice(2);
if (!bundlePath || !publicKeyPath) {
  console.error('Usage: npm run verify -- BUNDLE.json TRUSTED-ISSUER-PUBLIC.pem');
  process.exitCode = 1;
} else {
  try {
    const result = await verifyAnswerBundle(JSON.parse(readFileSync(bundlePath, 'utf8')), readFileSync(publicKeyPath, 'utf8'));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1; // Fail closed while proof verification is unavailable.
  } catch {
    console.error('Verification failed: unreadable or malformed bundle/trusted key.');
    process.exitCode = 1;
  }
}
