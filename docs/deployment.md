# Project site and releases

The repository has two distinct experiences:

- **Project overview:** the static page built from `site/index.html` and `assets/housingproof-hero.svg`.
- **Local prototype:** the Express custodian/agency simulation, started with `npm run dev`. It is not publicly deployed.

## GitHub Pages

Project URL: https://helloredwan.me/housingproof/

`.github/workflows/pages.yml` builds and publishes only `dist/site`. It never publishes the repository, dataset, private keys, witnesses, or server. Its successful deployment output is the authoritative public URL; use that to populate the repository homepage.

For this workflow, the repository Pages source must be **GitHub Actions** under Settings → Pages. The `github-pages` environment must permit deployments from `main`. Merging the presentation PR triggers the first deployment; the workflow also supports manual dispatch. A failed or missing deployment is not a live demo.

## Prereleases

The package version and its matching `docs/releases/vVERSION.md` define the release. The MVP version is `0.2.0-alpha.1`; the earlier foundation release remains immutable.

After this change lands on `main`, `.github/workflows/release.yml` runs the repository checks and publishes `v0.2.0-alpha.1` as a GitHub prerelease. It targets the triggering commit and leaves an existing release unchanged. Future stable releases need an explicit workflow decision; this workflow accepts alpha versions only.

The `v0.2.0-alpha.1` release describes the working synthetic proof MVP from [PR #5](https://github.com/Redoudou/housingproof/pull/5). The earlier `v0.1.0-alpha.1` foundation release had no working proofs. GitHub creates source archives for each tag; those are source distributions, not compiled application installers.

For what you can see and test after merge, follow [the MVP test guide](try-the-mvp.md). Merging does not deploy the live Node prover publicly. Check Actions for successful Pages deployment and prerelease publication; neither is guaranteed solely by merging.

## Repository About settings

The intended description, homepage, and topic list are recorded in `.github/repository-metadata.json`. Applying that file is a separate GitHub metadata operation; committing it does not automatically update About fields.

For the working local MVP, run `npm ci`, `npm run zk:build`, and `npm run dev`. Live proving requires the Node service; GitHub Pages serves only the static overview. Do not publish issuer private keys, runtime registrations, salts, or witnesses. The service listens on loopback and does not implement production authentication.
