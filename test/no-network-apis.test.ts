import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import { networkApis } from './block-network';

const root = path.join(__dirname, '..');

// The test setup names the network APIs to block them, and its own test calls them. The lint
// config names them to forbid them. Nothing else may.
const guards = new Set([
  'eslint.config.js',
  'test/setup.ts',
  'test/block-network.ts',
  'test/block-network.test.ts',
  'test/no-network-apis.test.ts',
]);

const scannedFolders = ['src', 'test', 'plugins', 'modules'];
const ignoredFolders = new Set(['node_modules', 'build', '.gradle', '.kotlin', 'Pods']);

// Native APIs that open connections. Kotlin and Swift are searched as text, comments removed:
// any match, including an import, fails the test.
const nativeNetworkApis: Record<string, readonly RegExp[]> = {
  '.kt': [
    /\bjava\.net\b/,
    /\bjavax\.net\b/,
    /\bokhttp3?\b/,
    /\bHttpURLConnection\b/,
    /\bURLConnection\b/,
    /\b(Server|Datagram)?Socket\b/,
    /\bandroid\.net\.http\b/,
    /\bWebView\b/,
  ],
  '.swift': [
    /\bURLSession\b/,
    /\bNSURLConnection\b/,
    /\bURLRequest\b/,
    /\bimport\s+Network\b/,
    /\bNWConnection\b/,
    /\bCFNetwork\b/,
    /\bWKWebView\b/,
  ],
};

function sourceFiles(): string[] {
  const rootFiles = fs
    .readdirSync(root)
    .filter((file) => /\.(ts|js|mjs|cjs)$/.test(file) && !file.endsWith('.d.ts'));
  return [...rootFiles, ...scannedFolders.flatMap((folder) => walk(folder))];
}

function walk(relative: string): string[] {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return ignoredFolders.has(entry.name) ? [] : walk(child);
    return /\.(tsx?|jsx?|mjs|cjs|kt|swift)$/.test(entry.name) ? [child] : [];
  });
}

// Identifiers and string keys, so `fetch()`, `globalThis.fetch` and `globalThis['fetch']` are
// found, while comments and longer names such as `prefetch` are not.
function scriptReferences(file: string, source: string): string[] {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const names = new Set<string>(networkApis);
  const found: string[] = [];
  function visit(node: ts.Node) {
    const isName =
      ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
    if (isName && names.has(node.text)) {
      const { line } = tree.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${file}:${line + 1} ${node.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return found;
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function nativeReferences(file: string, source: string): string[] {
  const patterns = nativeNetworkApis[path.extname(file)] ?? [];
  const code = withoutComments(source);
  return patterns.flatMap((pattern) => {
    const match = pattern.exec(code);
    return match === null ? [] : [`${file} ${match[0]}`];
  });
}

function references(file: string): string[] {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  return /\.(kt|swift)$/.test(file)
    ? nativeReferences(file, source)
    : scriptReferences(file, source);
}

describe('source files', () => {
  it('scan TypeScript, Kotlin and Swift', () => {
    const files = sourceFiles();
    expect(files).toContain('app.config.ts');
    expect(files.some((file) => file.endsWith('.kt'))).toBe(true);
    expect(files.some((file) => file.endsWith('.swift'))).toBe(true);
  });

  // docs/decisions/0006-no-network-access.md
  it('reference no network API outside the test setup and the lint rule', () => {
    const found = sourceFiles()
      .filter((file) => !guards.has(file))
      .flatMap(references);

    expect(found).toEqual([]);
  });
});

describe('the scan', () => {
  it('finds calls, global properties and string keys, not comments or longer names', () => {
    const source = [
      'fetch(url);',
      'new globalThis.WebSocket(url);',
      "globalThis['XMLHttpRequest'];",
      'const source = new EventSource(url);',
      '// fetch in a comment',
      'router.prefetch(route);',
    ].join('\n');

    expect(scriptReferences('a.ts', source)).toEqual([
      'a.ts:1 fetch',
      'a.ts:2 WebSocket',
      'a.ts:3 XMLHttpRequest',
      'a.ts:4 EventSource',
    ]);
  });

  it('finds Kotlin and Swift network APIs outside comments', () => {
    expect(nativeReferences('a.kt', 'import java.net.HttpURLConnection')).toEqual([
      'a.kt java.net',
      'a.kt HttpURLConnection',
    ]);
    expect(nativeReferences('a.kt', '// java.net.URL\n/* okhttp3 */ val x = 1')).toEqual([]);
    expect(nativeReferences('a.swift', 'let task = URLSession.shared.dataTask(with: url)')).toEqual(
      ['a.swift URLSession'],
    );
  });
});
