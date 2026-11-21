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

// Pages that flust hands to the browser or the phone app through Linking: that app makes the
// connection. Any other URL in the app's code could be loaded by flust itself, for example as an
// image source, a font or a download. The license texts of the list sources quote their URLs as
// text to read, shown in a Text and never opened.
const linkFiles = new Set([
  'src/domain/help-resources.ts',
  'src/features/settings/labels.ts',
  'src/features/settings/list-licenses.ts',
]);

const scannedFolders = ['src', 'test', 'plugins', 'modules'];
const ignoredFolders = new Set(['node_modules', 'build', '.gradle', '.kotlin', 'Pods']);
const scannedSource = /\.(tsx?|jsx?|mjs|cjs|kt|swift)$/;
const unscannedNativeSource = /\.(java|m|mm|c|cc|cpp|h|hpp)$/;

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
    /\bandroid\.net\.nsd\b/,
    /\bDownloadManager\b/,
    /\bWebView\b/,
    /\borg\.chromium\.net\b/,
    /\bio\.ktor\b/,
    /\bretrofit2\b/,
    /\bInetAddress\b/,
    /\bInetSocketAddress\b/,
    /\bVpnService\b/,
  ],
  '.swift': [
    /\bURLSession\b/,
    /\bNSURLSession\b/,
    /\bNSURLConnection\b/,
    /\bURLRequest\b/,
    /\b(Data|String)\(\s*contentsOf:/,
    /\bimport\s+Network\b/,
    /\bNWConnection\b/,
    /\bCFNetwork\b/,
    /\bCFStream\w*/,
    /\bimport\s+WebKit\b/,
    /\bWKWebView\b/,
    /\bSFSafariViewController\b/,
    /\bASWebAuthenticationSession\b/,
  ],
};

// The Android content filter is the only native code allowed to reach the network
// (docs/decisions/0033-android-filter-network-access.md), and each of its files only for its part:
// sockets in ResolverTransport.kt alone, which connects to the resolver's addresses and nothing
// else. Its tests run a local TLS server.
const filterSource = 'modules/flust-filter/android/src/main/java/org/fnyxgroup/flust/filter/';
const filterTests = 'modules/flust-filter/android/src/test/';
const filterAllowances: Record<string, readonly string[]> = {
  'ResolverTransport.kt': ['java.net', 'javax.net', 'Socket', 'InetAddress', 'InetSocketAddress'],
  'SystemTrust.kt': ['javax.net'],
  'Resolvers.kt': ['java.net', 'InetAddress'],
  'FilterVpnService.kt': ['VpnService'],
  'FilterBootReceiver.kt': ['VpnService'],
  'FilterRestartJob.kt': ['VpnService'],
  'FlustFilterModule.kt': ['VpnService'],
};

function allowedNative(file: string): readonly string[] | 'all' {
  if (file.startsWith(filterTests)) return 'all';
  if (!file.startsWith(filterSource)) return [];
  return filterAllowances[file.slice(filterSource.length)] ?? [];
}

function walk(relative: string): string[] {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return ignoredFolders.has(entry.name) ? [] : walk(child);
    return [child];
  });
}

function allFiles(): string[] {
  const rootFiles = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  return [...rootFiles, ...scannedFolders.flatMap((folder) => walk(folder))];
}

function sourceFiles(): string[] {
  return allFiles().filter((file) => scannedSource.test(file) && !file.endsWith('.d.ts'));
}

function isAppCode(file: string): boolean {
  return file.startsWith('src/') && !/\.test\.tsx?$/.test(file);
}

function parse(file: string, source: string): ts.SourceFile {
  const kind = /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

function collect(tree: ts.SourceFile, nameOf: (node: ts.Node) => string | null): string[] {
  const found: string[] = [];
  function visit(node: ts.Node) {
    const name = nameOf(node);
    if (name !== null) {
      const { line } = tree.getLineAndCharacterOfPosition(node.getStart());
      found.push(`${tree.fileName}:${line + 1} ${name}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return found;
}

// Identifiers and string keys, so `fetch()`, `globalThis.fetch` and `globalThis['fetch']` are
// found, while comments and longer names such as `prefetch` are not.
function scriptReferences(file: string, source: string): string[] {
  const names = new Set<string>(networkApis);
  return collect(parse(file, source), (node) => {
    const isName =
      ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
    return isName && names.has(node.text) ? node.text : null;
  });
}

function urlLiterals(file: string, source: string): string[] {
  return collect(parse(file, source), (node) => {
    const isText =
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node);
    return isText && /\b(https?|wss?|ftp):\/\//i.test(node.text) ? node.text : null;
  });
}

function blockCommentEnd(source: string, start: number): number {
  let depth = 0;
  let i = start;
  do {
    if (source.startsWith('/*', i)) {
      depth += 1;
      i += 2;
    } else if (source.startsWith('*/', i)) {
      depth -= 1;
      i += 2;
    } else {
      i += 1;
    }
  } while (depth > 0 && i < source.length);
  return i;
}

function stringEnd(source: string, start: number): number {
  if (source.startsWith('"""', start)) {
    const end = source.indexOf('"""', start + 3);
    return end === -1 ? source.length : end + 3;
  }
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote && source[i] !== '\n') {
    i += source[i] === '\\' ? 2 : 1;
  }
  return Math.min(i + 1, source.length);
}

// Kotlin and Swift nest block comments, and a string such as a URL may hold `//`: a regex would
// cut the code that follows it.
function withoutComments(source: string): string {
  let code = '';
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('//', i)) {
      const lineEnd = source.indexOf('\n', i);
      i = lineEnd === -1 ? source.length : lineEnd;
    } else if (source.startsWith('/*', i)) {
      i = blockCommentEnd(source, i);
      code += ' ';
    } else if (source[i] === '"' || source[i] === "'") {
      const end = stringEnd(source, i);
      code += source.slice(i, end);
      i = end;
    } else {
      code += source[i];
      i += 1;
    }
  }
  return code;
}

function nativeReferences(file: string, source: string): string[] {
  const patterns = nativeNetworkApis[path.extname(file)] ?? [];
  const code = withoutComments(source);
  return patterns.flatMap((pattern) => {
    const match = new RegExp(pattern.source, 'g');
    return [...code.matchAll(match)].map((found) => `${file} ${found[0]}`);
  });
}

function disallowedNativeReferences(file: string, source: string): string[] {
  const allowed = allowedNative(file);
  if (allowed === 'all') return [];
  return [...new Set(nativeReferences(file, source))].filter(
    (reference) => !allowed.includes(reference.slice(file.length + 1)),
  );
}

function references(file: string): string[] {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\.(kt|swift)$/.test(file)) return disallowedNativeReferences(file, source);
  const urls = isAppCode(file) && !linkFiles.has(file) ? urlLiterals(file, source) : [];
  return [...scriptReferences(file, source), ...urls];
}

describe('source files', () => {
  it('scan TypeScript, Kotlin and Swift', () => {
    const files = sourceFiles();
    expect(files).toContain('app.config.ts');
    expect(files.some((file) => file.endsWith('.kt'))).toBe(true);
    expect(files.some((file) => file.endsWith('.swift'))).toBe(true);
  });

  it('include no native language the scan cannot read', () => {
    expect(allFiles().filter((file) => unscannedNativeSource.test(file))).toEqual([]);
  });

  // docs/decisions/0006-no-network-access.md
  it('reference no network API or URL outside the test setup and the links', () => {
    const found = sourceFiles()
      .filter((file) => !guards.has(file))
      .flatMap(references);

    expect(found).toEqual([]);
  });
});

describe('the Android filter', () => {
  const sources = sourceFiles().filter((file) => file.startsWith(filterSource));

  it('is scanned', () => {
    expect(sources).toContain(`${filterSource}ResolverTransport.kt`);
  });

  // The filter opens sockets only to the resolver: one file opens them, to an endpoint that only
  // Resolvers.kt builds outside the tests.
  it('opens sockets in ResolverTransport.kt alone', () => {
    const opening = sources.filter((file) =>
      /\b(Socket|SSLSocket|SocketFactory|DatagramSocket|SocketChannel)\b/.test(
        withoutComments(fs.readFileSync(path.join(root, file), 'utf8')),
      ),
    );
    expect(opening).toEqual([`${filterSource}ResolverTransport.kt`]);
  });

  it('builds the resolver endpoints in Resolvers.kt alone', () => {
    const building = sources.filter((file) =>
      /\bResolverEndpoint\(/.test(withoutComments(fs.readFileSync(path.join(root, file), 'utf8'))),
    );
    expect(building.sort()).toEqual([
      `${filterSource}ResolverTransport.kt`,
      `${filterSource}Resolvers.kt`,
    ]);
  });

  // Logcat ends up in bug reports and is read by any tool with adb access: only FilterLog.kt
  // writes to it, and only in the development build. FilterTestLog.kt is the restart field test's,
  // in every build while the test lasts, and holds no name or address.
  it('logs through FilterLog.kt and the field test log alone', () => {
    const logging = sourceFiles().filter(
      (file) =>
        file.endsWith('.kt') &&
        !file.includes('/src/test/') &&
        /\bandroid\.util\.Log\b|\bLog\.(v|d|i|w|e|wtf)\(/.test(
          withoutComments(fs.readFileSync(path.join(root, file), 'utf8')),
        ),
    );
    expect(logging).toEqual([`${filterSource}FilterLog.kt`, `${filterSource}FilterTestLog.kt`]);
  });

  it('is the only native code that may use the network', () => {
    expect(allowedNative('modules/flust-reminders/android/src/main/java/a/A.kt')).toEqual([]);
    expect(allowedNative(`${filterSource}DotClient.kt`)).toEqual([]);
    expect(
      disallowedNativeReferences(`${filterSource}DotClient.kt`, 'val s = java.net.Socket()'),
    ).toEqual([`${filterSource}DotClient.kt java.net`, `${filterSource}DotClient.kt Socket`]);
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

  it('finds URLs in strings, templates and JSX, not in comments', () => {
    const source = [
      "const icon = 'https://example.com/a.png';",
      'const page = `https://example.com/${id}`;',
      '<Image source={{ uri: "http://example.com/b.png" }} />;',
      '// https://example.com in a comment',
      "const route = '/settings';",
    ].join('\n');

    expect(urlLiterals('a.tsx', source)).toEqual([
      'a.tsx:1 https://example.com/a.png',
      'a.tsx:2 https://example.com/',
      'a.tsx:3 http://example.com/b.png',
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
    expect(nativeReferences('a.swift', 'let data = try Data(contentsOf: url)')).toEqual([
      'a.swift Data(contentsOf:',
    ]);
  });

  it('reads code after a URL string and after nested comments', () => {
    expect(nativeReferences('a.kt', 'val u = "https://x"; val s = java.net.Socket()')).toEqual([
      'a.kt java.net',
      'a.kt Socket',
    ]);
    expect(nativeReferences('a.swift', '/* a /* b */ c */ let s = URLSession.shared')).toEqual([
      'a.swift URLSession',
    ]);
    expect(nativeReferences('a.kt', '/* a /* b */ java.net */ val x = 1')).toEqual([]);
  });
});
