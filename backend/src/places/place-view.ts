import { licensedPhotosOnly } from './normalize.js';
import type { LicensedPlacePhoto, NearbyPlace, PlaceDetails, PlaceExternalAction } from './types.js';

export function googleDirectionsUrl(place: Pick<NearbyPlace, 'latitude' | 'longitude'>): string {
  const query = new URLSearchParams({
    api: '1',
    destination: `${place.latitude},${place.longitude}`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

export function buildPlaceActions(place: {
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  bookingUrl?: string;
  bookingLabel?: string;
}): PlaceExternalAction[] {
  const actions: PlaceExternalAction[] = [
    { kind: 'directions', label: 'Directions', href: googleDirectionsUrl(place) },
  ];
  const phone = place.phone?.trim();
  if (phone) {
    actions.push({ kind: 'call', label: 'Call', href: `tel:${phone.replace(/[^\d+]/g, '')}` });
  }
  const website = place.website?.trim();
  if (website) {
    actions.push({ kind: 'website', label: 'Website', href: website });
  }
  const bookingUrl = place.bookingUrl?.trim();
  if (bookingUrl) {
    actions.push({
      kind: 'booking',
      label: place.bookingLabel?.trim() || 'Book',
      href: bookingUrl,
    });
  }
  return actions;
}

export function toPlaceDetails(
  nearby: NearbyPlace,
  extras: {
    phone?: string;
    website?: string;
    bookingUrl?: string;
    bookingLabel?: string;
    hoursLines?: string[];
    photos?: LicensedPlacePhoto[];
  } = {},
): PlaceDetails {
  const hoursLines = extras.hoursLines ?? [];
  const photos = licensedPhotosOnly(extras.photos);
  return {
    ...nearby,
    phone: extras.phone?.trim() || undefined,
    website: extras.website?.trim() || undefined,
    bookingUrl: extras.bookingUrl?.trim() || undefined,
    bookingLabel: extras.bookingLabel?.trim() || undefined,
    hoursSummary: hoursLines[0] ?? null,
    hoursLines,
    photos,
    actions: buildPlaceActions({
      latitude: nearby.latitude,
      longitude: nearby.longitude,
      phone: extras.phone,
      website: extras.website,
      bookingUrl: extras.bookingUrl,
      bookingLabel: extras.bookingLabel,
    }),
  };
}
