import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function segmentsFor(path, source) {
  const segments = [];
  const add = (start, text) => {
    if (/[A-Za-z]{3}/.test(text)) segments.push({ start, text });
  };
  if (path.endsWith('.html')) {
    // Protect markup, comments, scripts, styles, and preformatted examples.
    const re = /<!--[^]*?-->|<(script|style|pre|code)\b[^>]*>[^]*?<\/\1\s*>|<[^>]*>|([^<]+)/gi;
    for (const m of source.matchAll(re)) if (m[2]) add(m.index, m[2]);
  } else {
    let fenced = false, frontmatter = false, offset = 0;
    for (const line of source.split(/(?<=\n)/)) {
      if (offset === 0 && line.trim() === '---') frontmatter = true;
      else if (frontmatter && line.trim() === '---') { frontmatter = false; offset += line.length; continue; }
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; offset += line.length; continue; }
      if (!fenced && !frontmatter && !/^( {4}|\t|\s*\||\s*<!--|\s*\[[^\]]+\]:)/.test(line)) {
        const prefix = line.match(/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)?/)[0];
        add(offset + prefix.length, line.slice(prefix.length));
      }
      offset += line.length;
    }
  }
  return segments;
}

export function humanizeText(text) {
  const parts = text.split(/(`[^`\n]+`|!?\[[^\]\n]*\]\([^\n)]*\)|https?:\/\/[^\s<>]+|&(?:#\d+|#x[\da-f]+|\w+);)/gi);
  return parts.map((part, index) => {
    if (index % 2) return part;
    return part
      .replace(/[ \t]*—[ \t]*/g, ', ')
      .replace(/\b(in order to|utilizes|utilized|utilizing|utilize|additionally)\b/gi, word => {
        const replacements = { 'in order to': 'to', utilizes: 'uses', utilized: 'used', utilizing: 'using', utilize: 'use', additionally: 'also' };
        const replacement = replacements[word.toLowerCase()];
        if (word === word.toUpperCase()) return replacement.toUpperCase();
        return /^[A-Z]/.test(word) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
      });
  }).join('');
}

export function humanizeFile(path, source) {
  let result = source;
  for (const segment of segmentsFor(path, source).reverse()) {
    result = result.slice(0, segment.start) + humanizeText(segment.text) + result.slice(segment.start + segment.text.length);
  }
  return result;
}

function main() {
  const write = process.argv.includes('--write');
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(path =>
    path === 'README.md' || /^docs\/.*\.md$/.test(path) || /^site\/.*\.html$/.test(path));
  let changed = 0;
  for (const path of files) {
    const source = readFileSync(path, 'utf8'), updated = humanizeFile(path, source);
    if (source !== updated) {
      changed += 1;
      console.log(`${write ? 'Updated' : 'Needs formatting'}: ${path}`);
      if (write) writeFileSync(path, updated);
    }
  }
  console.log(`Prose formatter checked ${files.length} files; ${changed} ${write ? 'updated' : 'need formatting'}. No AI calls.`);
  if (!write && changed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
