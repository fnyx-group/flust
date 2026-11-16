import { MS_PER_DAY, type Timestamp } from '@/domain/time';

export type HelpCountry = 'FR' | 'BE' | 'CH' | 'CA' | 'US' | 'GB' | 'IE';
export type HelpRegion = HelpCountry | 'other';

// The order of the country picker.
export const HELP_REGIONS: readonly HelpRegion[] = [
  'FR',
  'BE',
  'CH',
  'CA',
  'US',
  'GB',
  'IE',
  'other',
];

export type HelpAction = 'call' | 'text';

export type HelpEntryId =
  | 'fr3114'
  | 'fr15'
  | 'fr112'
  | 'fr114'
  | 'be0800'
  | 'be1813'
  | 'be112'
  | 'be101'
  | 'ch143'
  | 'ch144'
  | 'ch117'
  | 'ch112'
  | 'ca988'
  | 'ca911'
  | 'us988'
  | 'us911'
  | 'gbSamaritans'
  | 'gb999'
  | 'gb112'
  | 'ieSamaritans'
  | 'ie112'
  | 'ie999'
  | 'eu112'
  | 'fallback112';

// Names and details are translations keyed by id. Each entry keeps the official page that states
// its number and what it offers, and the day that page was last read, so the list is reviewed.
export type HelpEntry = {
  id: HelpEntryId;
  kind: 'listen' | 'emergency';
  // As the service writes it: digits, grouped with spaces.
  display: string;
  actions: readonly HelpAction[];
  source: string;
  checkedOn: string;
};

export type HelpDirectory = { url: string; source: string; checkedOn: string };

const CHECKED_ON = '2026-11-16';
const SERVICE_PUBLIC = 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33954';
const EU_112 = 'https://digital-strategy.ec.europa.eu/en/policies/112';
const GOV_UK_999 = 'https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers';
const GARDA = 'https://www.garda.ie/en/contact-us/useful-contact-numbers/';
const BE_112 = 'https://www.112.be/';
const CH_POLICE = 'https://www.ch.ch/fr/police';

function entry(
  id: HelpEntryId,
  kind: HelpEntry['kind'],
  display: string,
  source: string,
  actions: readonly HelpAction[] = ['call'],
): HelpEntry {
  return { id, kind, display, actions, source, checkedOn: CHECKED_ON };
}

const COUNTRY_ENTRIES: Record<HelpCountry, readonly HelpEntry[]> = {
  FR: [
    entry('fr3114', 'listen', '3114', 'https://3114.fr/'),
    entry('fr15', 'emergency', '15', SERVICE_PUBLIC),
    entry('fr112', 'emergency', '112', SERVICE_PUBLIC),
    entry('fr114', 'emergency', '114', SERVICE_PUBLIC, ['text']),
  ],
  BE: [
    entry(
      'be0800',
      'listen',
      '0800 32 123',
      'https://www.preventionsuicide.be/la-ligne-decoute-0800-32-123',
    ),
    entry('be1813', 'listen', '1813', 'https://www.zelfmoord1813.be/'),
    entry('be112', 'emergency', '112', BE_112),
    entry('be101', 'emergency', '101', BE_112),
  ],
  CH: [
    entry('ch143', 'listen', '143', 'https://www.143.ch/fr'),
    entry('ch144', 'emergency', '144', CH_POLICE),
    entry('ch117', 'emergency', '117', CH_POLICE),
    entry('ch112', 'emergency', '112', CH_POLICE),
  ],
  CA: [
    entry('ca988', 'listen', '988', 'https://988.ca/get-help/what-to-expect', ['call', 'text']),
    entry(
      'ca911',
      'emergency',
      '911',
      'https://www.rcmp.ca/en/bc/safety-tips/emergency-services/tips-calling-emergency-services',
    ),
  ],
  US: [
    entry('us988', 'listen', '988', 'https://988lifeline.org/', ['call', 'text']),
    entry('us911', 'emergency', '911', 'https://www.usa.gov/report-crime'),
  ],
  GB: [
    entry(
      'gbSamaritans',
      'listen',
      '116 123',
      'https://www.samaritans.org/how-we-can-help/contact-samaritan/',
    ),
    entry('gb999', 'emergency', '999', GOV_UK_999),
    entry('gb112', 'emergency', '112', GOV_UK_999),
  ],
  IE: [
    entry('ieSamaritans', 'listen', '116 123', 'https://www.samaritans.org/ireland/'),
    entry('ie112', 'emergency', '112', GARDA),
    entry('ie999', 'emergency', '999', GARDA),
  ],
};

const EU_EMERGENCY = entry('eu112', 'emergency', '112', EU_112);
const FALLBACK_EMERGENCY = entry('fallback112', 'emergency', '112', EU_112);

export const HELP_DIRECTORY: HelpDirectory = {
  url: 'https://findahelpline.com',
  source: 'https://findahelpline.com/',
  checkedOn: CHECKED_ON,
};

// Every entry, for the review test.
export const ALL_HELP_ENTRIES: readonly HelpEntry[] = [
  ...Object.values(COUNTRY_ENTRIES).flat(),
  EU_EMERGENCY,
  FALLBACK_EMERGENCY,
];

// The overseas departments use the French numbers: 3114.fr states it answers "en métropole et
// outre-mer", and 15, 112 and 114 are national.
const FRENCH_REGIONS = new Set(['FR', 'GP', 'MQ', 'GF', 'RE', 'YT']);

// Member states of the European Union, where 112 is the official emergency number.
const EU_REGIONS = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
]);

function normalize(regionCode: string | null | undefined): string {
  return (regionCode ?? '').trim().toUpperCase();
}

export function helpRegionFor(regionCode: string | null | undefined): HelpRegion {
  const code = normalize(regionCode);
  if (FRENCH_REGIONS.has(code)) return 'FR';
  if (
    code === 'BE' ||
    code === 'CH' ||
    code === 'CA' ||
    code === 'US' ||
    code === 'GB' ||
    code === 'IE'
  ) {
    return code;
  }
  return 'other';
}

// The device region still matters for "other": in the European Union, 112 is named as the
// official number; elsewhere it is offered with the local number as the way out.
export function helpEntries(
  region: HelpRegion,
  deviceRegion: string | null | undefined,
): readonly HelpEntry[] {
  if (region !== 'other') return COUNTRY_ENTRIES[region];
  return [EU_REGIONS.has(normalize(deviceRegion)) ? EU_EMERGENCY : FALLBACK_EMERGENCY];
}

export function dialUrl(helpEntry: HelpEntry, action: HelpAction): string {
  const scheme = action === 'call' ? 'tel' : 'sms';
  return `${scheme}:${helpEntry.display.replace(/ /g, '')}`;
}

export const REVIEW_MAX_DAYS = 400;

// A calendar day, YYYY-MM-DD, as a UTC timestamp, or null when it is not a real day.
export function checkedOnTime(checkedOn: string): Timestamp | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(checkedOn);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? time : null;
}

export function reviewDue(checkedOn: string, now: Timestamp): boolean {
  const time = checkedOnTime(checkedOn);
  return time === null || now - time > REVIEW_MAX_DAYS * MS_PER_DAY;
}

// The oldest check of a list, which the screen shows: the list is as current as its oldest entry.
export function oldestCheck(checks: readonly { checkedOn: string }[]): string | null {
  return checks.reduce<string | null>(
    (oldest, { checkedOn }) => (oldest === null || checkedOn < oldest ? checkedOn : oldest),
    null,
  );
}
