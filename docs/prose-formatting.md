# Automatic prose formatting

Every push that changes the README, Markdown documents under `docs/`, or HTML pages under `site/` starts the Format prose workflow. It applies a small set of deterministic replacements:

- Replace em dashes in prose with a comma and space.
- Replace `in order to` with `to`.
- Replace forms of `utilize` with the corresponding form of `use`.
- Replace `additionally` with `also`.

The formatter preserves capitalization. It leaves inline code, fenced examples, Markdown tables, frontmatter, links, HTML attributes, scripts, styles, and preformatted examples alone. It does not edit JavaScript strings, SVG text, data files, or chat replies. En dashes are retained because they may express ranges. Review the resulting diff for punctuation that needs a sentence rewrite; simple replacements do not understand grammar or meaning.

Run `npm run prose:fix` locally to apply the rules. Run `npm run prose:check` to check without changing files. CI also tests the formatter and checks formatting on pushes, pull requests, and manual runs.

The formatter commits corrections to the same branch. It runs application checks and the site build before pushing corrections, then explicitly dispatches Checks for the new commit because GitHub-token pushes do not trigger another push workflow. For corrections on the default branch, it also dispatches the site deployment. It never force-pushes or bypasses branch protections. If branch protections prevent a bot commit, apply `npm run prose:fix` in a working branch and merge it through the usual review. A concurrent branch change may reject the bot push; rerun the workflow on the new tip. Fork pull requests receive the read-only formatting check; automatic rewriting runs on branches in this repository.

GitHub provides the workflow token. There are no model calls, external inference requests, or API-key secrets. The workflow does not need pull-request approval permission and does not approve or merge pull requests.

## Copilot editorial review

The repository also includes a pinned copy of [blader/humanizer](https://github.com/blader/humanizer), with its MIT license and upstream revision. Copilot instructions ask it to apply that skill whenever it writes or edits prose. This gives Copilot a broader editing guide while it works on a task. It is not an automatic AI execution step in CI, and it does not change content already published unless Copilot edits the files.

The formatter implements only the substitutions listed above. It does not claim to implement Humanizer's full editorial process or assess whether text was written by AI.
