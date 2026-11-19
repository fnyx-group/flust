import { domainToASCII } from 'node:url';

const LABEL = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const HOSTS_ADDRESSES = new Set(['0.0.0.0', '127.0.0.1', '::', '::1']);

// Lowercase ASCII, Punycode for internationalized names, at least two labels, no trailing dot.
// Null for anything a DNS query could never carry, such as an address or a wildcard.
export function normalizeDomain(raw: string): string | null {
  let name = raw.trim().toLowerCase();
  if (name.endsWith('.')) name = name.slice(0, -1);
  const ascii = domainToASCII(name);
  if (ascii === '' || ascii.length > 253 || IPV4.test(ascii)) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) return null;
  return ascii;
}

// A line of a source list: a plain domain, or a hosts file line. Null for blank and comment lines.
export function sourceLineName(line: string): string | null {
  const text = line.replace(/#.*/, '').trim();
  if (text === '') return null;
  const fields = text.split(/\s+/);
  const first = fields[0] ?? '';
  return HOSTS_ADDRESSES.has(first) ? (fields[1] ?? '') : first;
}

export type OwnEntry = { name: string; source: string; checked: string };

const OWN_LINE = /^(\S+)\s+#\s*(.+),\s*checked\s+(\d{4}-\d{2}-\d{2})\s*$/;

// A line of flust's own lists: `domain  # source, checked YYYY-MM-DD`. Null for blank and comment
// lines, 'invalid' for an entry without its source and date.
export function ownLine(line: string): OwnEntry | null | 'invalid' {
  const text = line.trim();
  if (text === '' || text.startsWith('#')) return null;
  const match = OWN_LINE.exec(text);
  if (match === null) return 'invalid';
  const [, name = '', source = '', checked = ''] = match;
  if (source.trim() === '') return 'invalid';
  return { name, source: source.trim(), checked };
}

export function commentsOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => /#(.*)$/.exec(line)?.[1] ?? '')
    .filter((comment) => comment.trim() !== '');
}

// The name and its parents down to two labels: `a.b.example.com`, `b.example.com`, `example.com`.
// The filter matches a query the same way (Blocklist.kt).
export function withParents(domain: string): string[] {
  const labels = domain.split('.');
  return labels.slice(0, -1).map((_, start) => labels.slice(start).join('.'));
}
