import { ARRIVAL_TRANSPORT_SEED } from './transport-content.js';
import type {
  ArrivalAirportCode,
  ArrivalTransferOptionView,
  ArrivalTransferRecommendation,
  ArrivalTransportOption,
  TransportMode,
} from './types.js';

interface TransferArea {
  id: string;
  label: string;
  aliases: string[];
  railFriendly: boolean;
  lastMile: string;
}

const GENERIC_AREA: TransferArea = {
  id: 'generic',
  label: 'your hotel',
  aliases: [],
  railFriendly: false,
  lastMile: 'A second taxi or Grab from KL Sentral if you take the train or bus.',
};

const TRANSFER_AREAS: TransferArea[] = [
  {
    id: 'kl-sentral',
    label: 'KL Sentral / Brickfields',
    aliases: ['kl sentral', 'sentral', 'brickfields', 'st. regis', 'st regis', 'hilton kuala lumpur'],
    railFriendly: true,
    lastMile: 'Usually a short walk from the KL Sentral platforms.',
  },
  {
    id: 'bukit-bintang',
    label: 'Bukit Bintang',
    aliases: ['bukit bintang', 'pavilion', 'starhill', 'w kuala lumpur', 'ritz-carlton', 'lotte hotel'],
    railFriendly: true,
    lastMile: 'Monorail or about 10 minutes by Grab from KL Sentral.',
  },
  {
    id: 'klcc',
    label: 'KLCC',
    aliases: ['klcc', 'petronas', 'mandarin oriental', 'grand hyatt', 'traders', 'suria', 'convention centre'],
    railFriendly: true,
    lastMile: 'LRT/Monorail or about 15–20 minutes by Grab from KL Sentral.',
  },
  {
    id: 'chinatown',
    label: 'Chinatown / Merdeka',
    aliases: ['chinatown', 'petaling street', 'merdeka'],
    railFriendly: true,
    lastMile: 'KTM/LRT from Sentral or a short Grab.',
  },
  {
    id: 'bangsar',
    label: 'Bangsar',
    aliases: ['bangsar'],
    railFriendly: true,
    lastMile: 'KTM Komuter or about 10 minutes by Grab from Sentral.',
  },
  {
    id: 'batu-caves',
    label: 'Batu Caves',
    aliases: ['batu caves'],
    railFriendly: true,
    lastMile: 'KTM Komuter from KL Sentral to Batu Caves station.',
  },
  {
    id: 'petaling-jaya',
    label: 'Petaling Jaya / Damansara',
    aliases: ['petaling jaya', 'damansara', 'sunway', 'subang'],
    railFriendly: false,
    lastMile: 'Door-to-door is usually faster than train plus a second taxi.',
  },
  {
    id: 'putrajaya',
    label: 'Putrajaya / Cyberjaya',
    aliases: ['putrajaya', 'cyberjaya'],
    railFriendly: false,
    lastMile: 'Highway ride is more direct than changing at KL Sentral.',
  },
  {
    id: 'genting',
    label: 'Genting Highlands',
    aliases: ['genting'],
    railFriendly: false,
    lastMile: 'Pre-booked transfer or Grab is the practical airport option.',
  },
];

const RAIL_MODES: TransportMode[] = ['ekspres', 'bus'];
const DOOR_MODES: TransportMode[] = ['e_hail', 'private'];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesAlias(query: string, alias: string): boolean {
  const pattern =
    alias.length <= 3
      ? new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, 'i')
      : new RegExp(escapeRegExp(alias), 'i');
  return pattern.test(query);
}

export function matchTransferArea(destination: string): TransferArea {
  const query = normalize(destination);
  const match = TRANSFER_AREAS.find((area) => area.aliases.some((alias) => matchesAlias(query, alias)));
  if (!match) {
    return { ...GENERIC_AREA, label: destination.trim() };
  }
  return match;
}

function reasonFor(option: ArrivalTransportOption, area: TransferArea, recommended: boolean): string {
  if (recommended && RAIL_MODES.includes(option.mode)) {
    return `Good match for ${area.label}: ride to KL Sentral on a fixed timetable, then ${area.lastMile}`;
  }
  if (recommended && DOOR_MODES.includes(option.mode)) {
    return `Door-to-door to ${area.label} with the published airport timing and fare band.`;
  }
  if (RAIL_MODES.includes(option.mode)) {
    return `Works if you do not mind a last mile: ${area.lastMile}`;
  }
  return `Direct drop-off at ${area.label} if you prefer not to change at KL Sentral.`;
}

function toView(option: ArrivalTransportOption, area: TransferArea, recommended: boolean): ArrivalTransferOptionView {
  return {
    id: option.id,
    mode: option.mode,
    name: option.name,
    badge: recommended ? 'Recommended' : option.badge,
    recommended,
    reason: reasonFor(option, area, recommended),
    estimatedCost: option.cost,
    estimatedDuration: option.duration,
    frequency: option.frequency,
    lastMile: RAIL_MODES.includes(option.mode) ? area.lastMile : undefined,
    boarding: option.boarding,
  };
}

export function recommendHotelTransfers(
  airportCode: ArrivalAirportCode,
  destination: string,
): ArrivalTransferRecommendation {
  const area = matchTransferArea(destination);
  const recommendedModes = new Set<TransportMode>(area.railFriendly ? RAIL_MODES : DOOR_MODES);
  const options = ARRIVAL_TRANSPORT_SEED.filter((option) => option.airportCode === airportCode)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((option) => toView(option, area, recommendedModes.has(option.mode)))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));

  const summary = area.railFriendly
    ? `KLIA Ekspres or the airport bus to KL Sentral, then a short hop to ${area.label}. Times and fares are the published airport estimates.`
    : `Grab/taxi or a private transfer is the most direct way to ${area.label}. Times and fares are the published airport estimates.`;

  return {
    airportCode,
    destination: destination.trim(),
    destinationLabel: area.label,
    areaId: area.id,
    railFriendly: area.railFriendly,
    summary,
    options,
  };
}
