export const MISSION_KINDS = ['embassy', 'high_commission', 'consulate'] as const;
export type MissionKind = (typeof MISSION_KINDS)[number];

export const DEFAULT_EMBASSY_COUNTRY = 'MY' as const;

const UNOFFICIAL_HOST_MARKERS = [
  'wikipedia.org',
  'facebook.com',
  'instagram.com',
  'tripadvisor',
  'embassypages.com',
  'embassy-finder',
  'yelp.com',
];

const OFFICIAL_HOST_PATTERNS: RegExp[] = [
  /\.gov(?:\.[a-z]{2})?$/i,
  /\.go\.jp$/i,
  /\.go\.kr$/i,
  /\.go\.id$/i,
  /\.gc\.ca$/i,
  /\.govt\.nz$/i,
  /\.diplo\.de$/i,
  /\.ambafrance\.org$/i,
  /\.thaiembassy\.org$/i,
  /\.ireland\.ie$/i,
  /\.netherlandsandyou\.nl$/i,
];

/** Official government / mission websites only — no aggregators or social pages. */
export function isOfficialMissionWebsite(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (UNOFFICIAL_HOST_MARKERS.some((marker) => host.includes(marker))) {
    return false;
  }
  return OFFICIAL_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export interface ForeignMission {
  id: string;
  name: string;
  sendingCountry: string;
  sendingCountryCode: string;
  kind: MissionKind;
  city: 'Kuala Lumpur';
  area: string;
  address?: string;
  officialWebsite: string;
  summary: string;
  whenToUse: string;
  hours: string;
  tags: string[];
  source: string;
  sourceUrl: string;
  sortOrder: number;
}

export interface MalaysiaEmbassySeed {
  country: typeof DEFAULT_EMBASSY_COUNTRY;
  destination: 'Malaysia';
  version: string;
  disclaimer: string;
  missions: ForeignMission[];
}

export interface EmbassyDirectoryResult {
  country: typeof DEFAULT_EMBASSY_COUNTRY;
  destination: 'Malaysia';
  version: string;
  q: string | null;
  kind: MissionKind | null;
  kinds: MissionKind[];
  disclaimer: string;
  missions: ForeignMission[];
}
