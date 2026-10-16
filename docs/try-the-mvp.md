# What to try after PR #5 merges

[PR #5](https://github.com/Redoudou/housingproof/pull/5) adds the working local proof MVP. You can register fictional filings, ask two fixed questions, see verified YES or NO answers, export the public evidence, and demonstrate rejection of a changed answer.

## Where to see it

| Experience | Where | What it does |
|---|---|---|
| Project overview | [helloredwan.me/housingproof](https://helloredwan.me/housingproof/) | Explains the project; a successful Pages deployment is required for published changes |
| Interactive story | [Public walkthrough](https://helloredwan.me/housingproof/walkthrough.html) | Scripted illustration of the proposed experience; does not generate proofs |
| Working proof demo | http://localhost:3000 after setup below | Generates fresh proofs from synthetic records and verifies them |
| Source release | [GitHub releases](https://github.com/Redoudou/housingproof/releases) | The merge triggers checks and the `v0.2.0-alpha.1` prerelease workflow; publication depends on success |

**Merging PR #5 does not put a live prover on the public website.** The working demo runs in the local Node service. The release provides source code, not an application installer. Check [Actions](https://github.com/Redoudou/housingproof/actions) for deployment and release results.

## Start the working demo

Requires Node.js 22+, Python 3, and internet access for the first proof setup.

For a new checkout after merge:

```bash
git clone https://github.com/Redoudou/housingproof.git
cd housingproof
npm ci
npm run zk:build
npm run dev
```

For an existing checkout, first switch to `main` and pull the merged changes with a clean working tree, then run the three npm commands above. Open http://localhost:3000 and keep that terminal running. The terminal stays occupied while the local server is available; this is normal and does not mean the build is unfinished. Stop the server with Ctrl+C when done.

You will see **DOF simulation**, **Agency portal**, and **Verify without the filing**. Both roles share one local app; the separation illustrates the data boundary rather than production access control.

## First test: a verified YES, then NO

1. Under **Current source**, select `DEMO-RPIE-001-2025-BASE`.
2. Click **Register current filing**. A signed simulator receipt and source commitment appear.
3. Leave the approved question on **Q001 · At least 20 regulated units?**
4. Click **Generate & verify proof**. Wait for **ZK PROOF VERIFIED** and **YES**. The baseline reports 24 regulated units.
5. Select `DEMO-RPIE-001-2025-BELOW-COUNT`, register it, and ask Q001 again. Expect a verified **NO** because this variant reports 19 units.
6. Try `DEMO-RPIE-001-2025-EXACT-COUNT`. Register and ask again: exactly 20 returns **YES**.

The counts above explain the fictional fixtures for this test. The returned public bundle does not contain those hidden count fields. Selecting a different source or question clears the previous answer and export control.

## Second test: compare two years

1. Select **Q002 · Operating balance down more than 20%?** The prior-year source controls appear.
2. Select `DEMO-RPIE-001-2024-BASE` under **Prior-year source** and click **Register prior filing**.
3. Choose each current source below, click **Register current filing**, then **Generate & verify proof**. Keep the 2024 baseline selected as the prior source.

| Current source suffix | Scenario | Expected answer |
|---|---|---|
| `2025-BASE` | Operating balance declines 10% | Verified NO |
| `2025-STRESS` | Operating balance declines 30% | Verified YES |
| `2025-EXACT-DECLINE` | Decline is exactly 20% | Verified NO |
| `2025-NEGATIVE` | Current balance is negative; prior balance is positive | Verified YES |

All IDs begin with `DEMO-RPIE-001-`. The question uses calculated reported operating balance, not a DOF valuation or a finding of financial distress.

## Export, verify, and change an answer

After a successful answer:

1. Click **Export verified answer bundle ↓** to download `answer-bundle.json`.
2. Click **Verify current bundle** in the verification panel. Expect **VERIFIED**.
3. Click **Test a changed answer**. It flips a copy of the answer and its public-input field while retaining the original proof. Expect **REJECTED**. The original bundle stays unchanged.
4. Use **Import bundle JSON** to load the unmodified downloaded file. Expect **VERIFIED** again.
5. Expand **Verify in a separate environment** and download the simulator public issuer key. For this local demo, that download comes from the same simulator; real recipients need independently provisioned trust anchors.

To run the standalone verifier, put the downloaded files in the repository root (or supply their actual paths) and open a second terminal:

```bash
npm run verify -- answer-bundle.json trusted-issuer-public.pem
```

Expect `"verified": true` and exit code 0. Invalid or rejected bundles return a nonzero exit code. Verification requires the public bundle, trusted issuer public key, and locally pinned public circuit artifacts; it does not require the private filing or issuer private key. The separate-environment test in `npm run test:zk` demonstrates that boundary.

## Failure cases worth trying

| Action | Expected behavior |
|---|---|
| Ask before registering the current source | NOT REGISTERED; no answer or export |
| Select `2025-INCOMPLETE` or `2025-INVALID` and register | Registration rejected |
| Ask Q002 without a registered prior source | UNAVAILABLE; no answer or export |
| Register and select `2024-ZERO` as the Q002 prior source | UNAVAILABLE because prior balance is not positive |
| Change an exported answer or proof and import it | REJECTED; never interpreted as a valid NO |

The interface fixes question parameters. API requests that change the approved question or threshold are denied. Proof-service failures also withhold the answer and bundle.

## Timing and repeatability

On the recorded test machine, generation including startup and self-check took about 6–7 seconds for Q001 and 11–12 seconds for Q002. The service then separately verifies the public bundle before releasing an answer. Allow additional time on other machines; a proof worker has a three-minute timeout. The first setup can take longer while public proving parameters are initialized. See [validation evidence and measurements](mvp-validation.md).

Repeat questions to generate fresh proofs; there is no replay mode. Restarting the service clears registrations and the in-memory disclosure log, so register sources again. Keep the original public issuer key to verify older exports if the local key files are replaced.

For automated verification:

```bash
npm run check
npm test
npm run test:zk
npx playwright install chromium
npm run test:browser
```

The MVP uses fictional records and simulated issuance. It has no bulk filing importer, production authentication, or real DOF connection. A verified answer establishes the calculation against the committed reported values, not the accuracy of an owner's declaration or permission to disclose real data.
