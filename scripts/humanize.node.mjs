import test from 'node:test';
import assert from 'node:assert/strict';
import { humanizeFile, humanizeText } from './humanize.mjs';

test('uses a small case-aware vocabulary and replaces em dashes', () => {
  assert.equal(humanizeText('Additionally, utilize this—in order to test.'), 'Also, use this, to test.');
  assert.equal(humanizeText('UTILIZED; utilizing; utilizes.'), 'USED; using; uses.');
});
test('preserves code, links, numbers and meaningful qualifications', () => {
  const source = 'Not verified. At least 20. `utilize—x` [utilize](https://example.com/a—b) https://example.com/utilize—x';
  assert.equal(humanizeText(source), source);
});
test('does not alter HTML structure, attributes, scripts, styles or examples', () => {
  const source = '<a title="utilize—x" href="/utilize">Utilize this—privately.</a><script>const x="utilize—x";</script><style>/* utilize—x */</style><pre>utilize—x</pre><!-- utilize—x -->';
  assert.equal(humanizeFile('site/index.html', source), '<a title="utilize—x" href="/utilize">Use this, privately.</a><script>const x="utilize—x";</script><style>/* utilize—x */</style><pre>utilize—x</pre><!-- utilize—x -->');
});
test('preserves Markdown metadata, fenced examples, tables and indented code', () => {
  const source = '---\ntitle: utilize—x\n---\n# Utilize this\n\n```sh\nutilize—x\n```\n    utilize—x\n| utilize—x |\n';
  assert.equal(humanizeFile('docs/example.md', source), source.replace('# Utilize this', '# Use this'));
});
test('formatting is idempotent', () => {
  const source = '# Additionally\nUtilize this—in order to test.\n';
  const once = humanizeFile('README.md', source);
  assert.equal(humanizeFile('README.md', once), once);
});
