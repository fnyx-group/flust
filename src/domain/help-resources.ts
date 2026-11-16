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

// Names and details are translations keyed by id. Each entry keeps the official pages that state
// its number and what it offers, and the day they were last read, so the list is reviewed.
export type HelpEntry = {
  id: HelpEntryId;
  kind: 'listen' | 'emergency';
  // As the service writes it: digits, grouped with spaces.
  display: string;
  actions: readonly HelpAction[];
  sources: readonly string[];
  checkedOn: string;
  // Device regions mapped to this country where no official page confirms the number: it is
  // left out there.
  unconfirmedIn: readonly string[];
};

export type HelpDirectory = { url: string; sources: readonly string[]; checkedOn: string };

const CHECKED_ON = '2026-11-16';
const SERVICE_PUBLIC = 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33954';
const EU_112 = 'https://digital-strategy.ec.europa.eu/en/policies/112';
const GOV_UK_999 = 'https://www.gov.uk/guidance/999-and-112-the-uks-national-emergency-numbers';
const GARDA = 'https://www.garda.ie/en/contact-us/useful-contact-numbers/';
const BE_112 = 'https://www.112.be/';
const CH_POLICE = 'https://www.ch.ch/fr/police';
// The health ministry's emergency pages for each overseas department; none was found for Mayotte.
const SANTE_OVERSEAS = [
  'https://www.sante.fr/node/1184266',
  'https://www.sante.fr/node/1285437',
  'https://www.sante.fr/node/7063615',
  'https://www.sante.fr/urgences-les-numeros-utiles-la-reunion',
];

type EntryOptions = { actions?: readonly HelpAction[]; unconfirmedIn?: readonly string[] };

function entry(
  id: HelpEntryId,
  kind: HelpEntry['kind'],
  display: string,
  sources: readonly string[],
  { actions = ['call'], unconfirmedIn = [] }: EntryOptions = {},
): HelpEntry {
  return { id, kind, display, actions, sources, checkedOn: CHECKED_ON, unconfirmedIn };
}

const COUNTRY_ENTRIES: Record<HelpCountry, readonly HelpEntry[]> = {
  // 3114.fr states it answers "en métropole et outre-mer", and 112 holds everywhere in the
  // European Union, the overseas departments included. 15 and 114 are confirmed for each overseas
  // department by its own page, except Mayotte.
  FR: [
    entry('fr3114', 'listen', '3114', ['https://3114.fr/']),
    entry('fr15', 'emergency', '15', [SERVICE_PUBLIC, ...SANTE_OVERSEAS], {
      unconfirmedIn: ['YT'],
    }),
    entry('fr112', 'emergency', '112', [SERVICE_PUBLIC, EU_112]),
    entry('fr114', 'emergency', '114', [SERVICE_PUBLIC, ...SANTE_OVERSEAS], {
      actions: ['text'],
      unconfirmedIn: ['YT'],
    }),
  ],
  BE: [
    entry('be0800', 'listen', '0800 32 123', [
      'https://www.preventionsuicide.be/la-ligne-decoute-0800-32-123',
    ]),
    entry('be1813', 'listen', '1813', ['https://www.zelfmoord1813.be/']),
    entry('be112', 'emergency', '112', [BE_112]),
    entry('be101', 'emergency', '101', [BE_112]),
  ],
  CH: [
    // The cost of a call is on the ch.ch page, not on 143.ch.
    entry('ch143', 'listen', '143', ['https://www.143.ch/fr', CH_POLICE]),
    entry('ch144', 'emergency', '144', [CH_POLICE]),
    entry('ch117', 'emergency', '117', [CH_POLICE]),
    entry('ch112', 'emergency', '112', [CH_POLICE]),
  ],
  CA: [
    entry(
      'ca988',
      'listen',
      '988',
      ['https://988.ca/get-help/what-to-expect', 'https://988.ca/fr'],
      {
        actions: ['call', 'text'],
      },
    ),
    // The CRTC states 911 reaches almost all subscribers, not all: where it does not, such as in
    // Nunavut, emergency services have a normal telephone number.
    entry('ca911', 'emergency', '911', [
      'https://crtc.gc.ca/eng/phone/911/can.htm',
      'https://crtc.gc.ca/fra/phone/911/can.htm',
    ]),
  ],
  US: [
    entry('us988', 'listen', '988', ['https://988lifeline.org/'], { actions: ['call', 'text'] }),
    entry('us911', 'emergency', '911', ['https://www.usa.gov/report-crime']),
  ],
  GB: [
    entry('gbSamaritans', 'listen', '116 123', [
      'https://www.samaritans.org/how-we-can-help/contact-samaritan/',
    ]),
    entry('gb999', 'emergency', '999', [GOV_UK_999]),
    entry('gb112', 'emergency', '112', [GOV_UK_999]),
  ],
  IE: [
    entry('ieSamaritans', 'listen', '116 123', ['https://www.samaritans.org/ireland/']),
    entry('ie112', 'emergency', '112', [GARDA]),
    entry('ie999', 'emergency', '999', [GARDA]),
  ],
};

const EU_EMERGENCY = entry('eu112', 'emergency', '112', [EU_112]);
const FALLBACK_EMERGENCY = entry('fallback112', 'emergency', '112', [EU_112]);

export const HELP_DIRECTORY: HelpDirectory = {
  url: 'https://findahelpline.com',
  sources: ['https://findahelpline.com/'],
  checkedOn: CHECKED_ON,
};

// Every entry, for the review test.
export const ALL_HELP_ENTRIES: readonly HelpEntry[] = [
  ...Object.values(COUNTRY_ENTRIES).flat(),
  EU_EMERGENCY,
  FALLBACK_EMERGENCY,
];

// The overseas departments use the French numbers, less those no official page confirms there.
const FRENCH_REGIONS = new Set(['FR', 'GP', 'MQ', 'GF', 'RE', 'YT']);

// Member states of the European Union, where 112 is the official emergency number, and Saint-Martin,
// which is part of the Union under its own region code.
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
  'MF',
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

// The device region still matters. A listed country leaves out the numbers no official page
// confirms for that region. For "other", 112 is named as the official number only when the device
// itself is set to an unlisted member of the European Union: someone whose device is set to a
// listed country and who picks "other" is somewhere else, perhaps outside the Union, and needs the
// local number as the way out.
export function helpEntries(
  region: HelpRegion,
  deviceRegion: string | null | undefined,
): readonly HelpEntry[] {
  const code = normalize(deviceRegion);
  if (region !== 'other') {
    return COUNTRY_ENTRIES[region].filter((entry) => !entry.unconfirmedIn.includes(code));
  }
  const unlistedEu = helpRegionFor(code) === 'other' && EU_REGIONS.has(code);
  return [unlistedEu ? EU_EMERGENCY : FALLBACK_EMERGENCY];
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
