export type ErrorKind = 'render' | 'fatal' | 'uncaught' | 'unhandled-rejection' | 'storage-failure';

// What the error log keeps of an error. Never its message: messages can carry note text, plan
// wording or SQL values. Every field is checked against a pattern that only code identifiers,
// route patterns, file names and numbers can match. See docs/decisions/0029-local-error-log.md.
export type ErrorEntry = {
  readonly at: number;
  readonly kind: ErrorKind;
  readonly route: string | null;
  readonly name: string | null;
  readonly code: string | null;
  readonly frames: readonly string[];
};

export type ErrorInput = {
  readonly at: number;
  readonly kind: ErrorKind;
  readonly error?: unknown;
  readonly route?: string | null;
  readonly code?: string | null;
};

export type ReportMeta = {
  readonly now: number;
  readonly version: string | null;
  readonly platform: string;
  readonly osVersion: string;
};

export const MAX_ENTRIES = 50;
export const MAX_FRAMES = 15;

const KINDS: readonly ErrorKind[] = [
  'render',
  'fatal',
  'uncaught',
  'unhandled-rejection',
  'storage-failure',
];

const NAME = /^[A-Za-z_$][\w$]{0,63}$/;
const CODE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const MAX_CODE_LENGTH = 48;
const MAX_ROUTE_LENGTH = 80;
const MAX_SEGMENT_LENGTH = 24;
// A group such as "(tabs)", a parameter as written in the file name such as "[id]", or a word.
const SEGMENT = /^(?:\([a-z0-9-]+\)|\[(?:\.\.\.)?[A-Za-z]+\]|[a-z0-9][a-z0-9_+-]*)$/;
// Ids and tokens: only digits, or several of them mixed with letters.
const ID_LIKE = /^\d+$|(?:\D*\d){4}/;
const FUNCTION_NAME = /^[\w$.<>?]{1,80}$/;
const FILE_NAME = /^[\w.-]{1,80}$/;
const FRAME = /^[\w$.<>?]{1,80}@[\w.-]{1,80}:\d{1,9}:\d{1,9}$/;

// "at fn (file:1:2)", "at fn (address at file:1:2)" (Hermes) and "at file:1:2". Every other line,
// including the first one of a V8 stack, which holds the message, is left out.
const STACK_LINE = /^\s*at\s+(?:(\S+?)\s+\()?(?:address at\s+)?([^()\s]+):(\d+):(\d+)\)?\s*$/;

export function toEntry(input: ErrorInput): ErrorEntry {
  const error = input.error;
  return {
    at: input.at,
    kind: input.kind,
    route: validRoute(input.route ?? null),
    name: error instanceof Error && NAME.test(error.name) ? error.name : null,
    code: validCode(input.code ?? null),
    frames:
      error instanceof Error && typeof error.stack === 'string' ? parseStack(error.stack) : [],
  };
}

export function parseStack(stack: string): string[] {
  const frames: string[] = [];
  for (const line of stack.split('\n')) {
    if (frames.length === MAX_FRAMES) break;
    const frame = parseFrame(line);
    if (frame !== null) frames.push(frame);
  }
  return frames;
}

function parseFrame(line: string): string | null {
  const match = STACK_LINE.exec(line);
  if (match === null) return null;
  const [, functionName, location, lineNumber, column] = match;
  // Development bundles are served from an address with a query; only the file name is kept.
  const file = (location ?? '').split('/').pop()?.split('?')[0] ?? '';
  if (!FILE_NAME.test(file)) return null;
  const name = functionName !== undefined && FUNCTION_NAME.test(functionName) ? functionName : '?';
  return `${name}@${file}:${lineNumber}:${column}`;
}

// A screen's route name is its file's pattern relative to its layout, such as "journal" or
// "note/[id]": a parameter reads "[id]", never its value.
export function routeFromName(name: string): string {
  return `/${name}`;
}

function validRoute(route: string | null): string | null {
  if (route === null || route.length > MAX_ROUTE_LENGTH || !route.startsWith('/')) return null;
  if (route === '/') return route;
  return route.slice(1).split('/').every(isPlainSegment) ? route : null;
}

function isPlainSegment(segment: string): boolean {
  return segment.length <= MAX_SEGMENT_LENGTH && SEGMENT.test(segment) && !ID_LIKE.test(segment);
}

function validCode(code: string | null): string | null {
  return code !== null && code.length <= MAX_CODE_LENGTH && CODE.test(code) ? code : null;
}

export function appendEntries(
  entries: readonly ErrorEntry[],
  added: readonly ErrorEntry[],
): ErrorEntry[] {
  return [...entries, ...added].slice(-MAX_ENTRIES);
}

export function isErrorEntry(value: unknown): value is ErrorEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    Object.keys(entry).length === 6 &&
    typeof entry.at === 'number' &&
    Number.isSafeInteger(entry.at) &&
    KINDS.includes(entry.kind as ErrorKind) &&
    (entry.route === null ||
      (typeof entry.route === 'string' && validRoute(entry.route) !== null)) &&
    (entry.name === null || (typeof entry.name === 'string' && NAME.test(entry.name))) &&
    (entry.code === null || (typeof entry.code === 'string' && validCode(entry.code) !== null)) &&
    Array.isArray(entry.frames) &&
    entry.frames.length <= MAX_FRAMES &&
    entry.frames.every((frame) => typeof frame === 'string' && FRAME.test(frame))
  );
}

// The report is technical text for whoever fixes the bug, so it stays in English whatever the
// app language, and the same text is shown before it is shared.
export function formatReport(entries: readonly ErrorEntry[], meta: ReportMeta): string {
  const header = [
    'flust error report',
    `Created: ${isoTime(meta.now)}`,
    `App: ${meta.version ?? 'unknown'}`,
    `System: ${meta.platform} ${meta.osVersion}`,
    `Entries: ${entries.length}`,
  ];
  const blocks = entries.map((entry, index) => formatEntry(entry, index + 1));
  return [header.join('\n'), ...blocks].join('\n\n');
}

function formatEntry(entry: ErrorEntry, number: number): string {
  const lines = [`${number}. ${isoTime(entry.at)}`, `   Kind: ${entry.kind}`];
  if (entry.route !== null) lines.push(`   Screen: ${entry.route}`);
  if (entry.name !== null) lines.push(`   Error: ${entry.name}`);
  if (entry.code !== null) lines.push(`   Code: ${entry.code}`);
  for (const frame of entry.frames) lines.push(`   at ${frame}`);
  return lines.join('\n');
}

function isoTime(time: number): string {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? 'unknown time' : date.toISOString();
}
