import { MALAYSIA_EMBASSY_SEED } from './content.js';
import {
  isOfficialMissionWebsite,
  MISSION_KINDS,
  type EmbassyDirectoryResult,
  type MissionKind,
} from './types.js';

export interface EmbassyQuery {
  q?: string;
  kind?: MissionKind;
}

function matchesQuery(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Same contract as GET /embassies — searchable KL missions with official websites only. */
export function queryEmbassies(filters: EmbassyQuery = {}): EmbassyDirectoryResult {
  const needle = filters.q?.trim();

  const missions = MALAYSIA_EMBASSY_SEED.missions
    .filter(
      (mission) =>
        isOfficialMissionWebsite(mission.officialWebsite) &&
        mission.sourceUrl === mission.officialWebsite,
    )
    .filter((mission) => (filters.kind ? mission.kind === filters.kind : true))
    .filter((mission) => {
      if (!needle) return true;
      const blob = [
        mission.name,
        mission.sendingCountry,
        mission.sendingCountryCode,
        mission.kind,
        mission.city,
        mission.area,
        mission.address ?? '',
        mission.tags.join(' '),
      ].join(' ');
      return matchesQuery(blob, needle);
    })
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.sendingCountry.localeCompare(b.sendingCountry) ||
        a.id.localeCompare(b.id),
    );

  return {
    country: MALAYSIA_EMBASSY_SEED.country,
    destination: MALAYSIA_EMBASSY_SEED.destination,
    version: MALAYSIA_EMBASSY_SEED.version,
    q: needle ?? null,
    kind: filters.kind ?? null,
    kinds: [...MISSION_KINDS],
    disclaimer: MALAYSIA_EMBASSY_SEED.disclaimer,
    missions,
  };
}
