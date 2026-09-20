-- Idempotent development seed. Prefer `npm run db:seed` which wraps this in a transaction.
-- Safe to re-run: unique email/slug/referral_code and ON CONFLICT guards.

INSERT INTO users (email, display_name)
VALUES ('demo@tourist-companion.local', 'Demo Traveller')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO users (email, display_name, role)
VALUES ('ops@tourist-companion.local', 'Ops Admin', 'admin')
ON CONFLICT (email) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role;

INSERT INTO tourist_profiles (user_id, language, dietary_preferences, mobility_needs, travel_style)
SELECT id, 'en', ARRAY['halal']::text[], '{}'::text[], 'balanced'
FROM users
WHERE email = 'demo@tourist-companion.local'
ON CONFLICT (user_id) DO UPDATE SET
  language = EXCLUDED.language,
  dietary_preferences = EXCLUDED.dietary_preferences,
  mobility_needs = EXCLUDED.mobility_needs,
  travel_style = EXCLUDED.travel_style;

INSERT INTO trips (user_id, destination, start_date, end_date, status)
SELECT id, 'Kuala Lumpur', DATE '2026-10-01', DATE '2026-10-08', 'active'
FROM users
WHERE email = 'demo@tourist-companion.local'
  AND NOT EXISTS (
    SELECT 1 FROM trips
    WHERE user_id = users.id AND destination = 'Kuala Lumpur'
  );

INSERT INTO places (name, category, description, city, country, latitude, longitude)
SELECT 'KLIA Terminal 1', 'airport', 'Main KLIA arrival terminal', 'Sepang', 'MY', 2.7433, 101.6980
WHERE NOT EXISTS (SELECT 1 FROM places WHERE name = 'KLIA Terminal 1');

INSERT INTO providers (
  name,
  slug,
  category,
  website,
  contact_email,
  commission_rate,
  commission_basis,
  commission_currency,
  is_active,
  listing_summary,
  listing_city,
  listing_area,
  booking_url,
  disclosure,
  sponsored,
  languages,
  listing_extras
)
VALUES (
  'Grab Malaysia',
  'grab-malaysia',
  'transfers',
  'https://www.grab.com/my/',
  'partners@example.com',
  0.0500,
  'booking',
  'MYR',
  TRUE,
  'Licensed e-hailing rides across Malaysia, including airport pickup at KLIA and KLIA2.',
  'Kuala Lumpur',
  'KLIA / KLIA2',
  'https://www.grab.com/my/',
  'We may earn a commission if you book or buy through this link.',
  FALSE,
  ARRAY['en', 'ms']::text[],
  '{"vehicleClass": "car", "airportCodes": ["KUL", "KLIA2"], "meetAndGreet": false}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  website = EXCLUDED.website,
  contact_email = EXCLUDED.contact_email,
  commission_rate = EXCLUDED.commission_rate,
  commission_basis = EXCLUDED.commission_basis,
  listing_summary = EXCLUDED.listing_summary,
  listing_city = EXCLUDED.listing_city,
  listing_area = EXCLUDED.listing_area,
  booking_url = EXCLUDED.booking_url,
  disclosure = EXCLUDED.disclosure,
  sponsored = EXCLUDED.sponsored,
  languages = EXCLUDED.languages,
  listing_extras = EXCLUDED.listing_extras;

INSERT INTO providers (
  name,
  slug,
  category,
  website,
  contact_email,
  commission_rate,
  commission_basis,
  commission_currency,
  is_active,
  listing_summary,
  listing_city,
  listing_area,
  booking_url,
  disclosure,
  sponsored,
  typical_myr,
  languages,
  listing_extras
)
VALUES (
  'Klook Malaysia',
  'klook-malaysia',
  'tours',
  'https://www.klook.com/',
  'partners@example.com',
  0.0600,
  'booking',
  'MYR',
  TRUE,
  'Day tours, attraction tickets, and hotel pickup across Kuala Lumpur.',
  'Kuala Lumpur',
  'KLCC',
  'https://www.klook.com/',
  'We may earn a commission if you book or buy through this link.',
  TRUE,
  'RM 80–250',
  ARRAY['en', 'ms']::text[],
  '{"durationHint": "Half day to full day", "meetingPoint": "KLCC / hotel pickup"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  website = EXCLUDED.website,
  contact_email = EXCLUDED.contact_email,
  commission_rate = EXCLUDED.commission_rate,
  commission_basis = EXCLUDED.commission_basis,
  listing_summary = EXCLUDED.listing_summary,
  listing_city = EXCLUDED.listing_city,
  listing_area = EXCLUDED.listing_area,
  booking_url = EXCLUDED.booking_url,
  disclosure = EXCLUDED.disclosure,
  sponsored = EXCLUDED.sponsored,
  typical_myr = EXCLUDED.typical_myr,
  languages = EXCLUDED.languages,
  listing_extras = EXCLUDED.listing_extras;

INSERT INTO providers (
  name,
  slug,
  category,
  website,
  contact_email,
  commission_rate,
  commission_basis,
  commission_currency,
  is_active,
  listing_summary,
  listing_city,
  listing_area,
  booking_url,
  disclosure,
  sponsored,
  typical_myr,
  languages,
  listing_extras
)
VALUES (
  'CelcomDigi tourist eSIM',
  'celcomdigi-esim',
  'sim',
  'https://www.celcomdigi.com/',
  'partners@example.com',
  0.0800,
  'activation',
  'MYR',
  TRUE,
  'Airport prepaid SIM and eSIM packs after KLIA and KLIA2 customs. Passport required.',
  'Sepang',
  'KLIA / KLIA2',
  'https://www.celcomdigi.com/',
  'We may earn a commission if you book or buy through this link.',
  FALSE,
  'From RM 30',
  ARRAY['en', 'ms']::text[],
  '{"connectivityKind": "esim", "dataAllowance": "10–40 GB", "validity": "7–30 days", "passportRequired": true, "airportCodes": ["KUL", "KLIA2"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  website = EXCLUDED.website,
  contact_email = EXCLUDED.contact_email,
  commission_rate = EXCLUDED.commission_rate,
  commission_basis = EXCLUDED.commission_basis,
  listing_summary = EXCLUDED.listing_summary,
  listing_city = EXCLUDED.listing_city,
  listing_area = EXCLUDED.listing_area,
  booking_url = EXCLUDED.booking_url,
  disclosure = EXCLUDED.disclosure,
  sponsored = EXCLUDED.sponsored,
  typical_myr = EXCLUDED.typical_myr,
  languages = EXCLUDED.languages,
  listing_extras = EXCLUDED.listing_extras;

INSERT INTO trip_places (trip_id, place_id, sort_order, notes)
SELECT t.id, p.id, 0, 'Arrival checkpoint'
FROM trips t
JOIN users u ON u.id = t.user_id
JOIN places p ON p.name = 'KLIA Terminal 1'
WHERE u.email = 'demo@tourist-companion.local'
  AND t.destination = 'Kuala Lumpur'
ON CONFLICT (trip_id, place_id) DO NOTHING;

INSERT INTO referrals (user_id, trip_id, provider_id, place_id, referral_code, status, channel, metadata)
SELECT
  u.id,
  t.id,
  pr.id,
  pl.id,
  'DEMO-GRAB-001',
  'pending',
  'arrival',
  '{"source": "seed"}'::jsonb
FROM users u
JOIN trips t ON t.user_id = u.id AND t.destination = 'Kuala Lumpur'
JOIN providers pr ON pr.slug = 'grab-malaysia'
JOIN places pl ON pl.name = 'KLIA Terminal 1'
WHERE u.email = 'demo@tourist-companion.local'
ON CONFLICT (referral_code) DO NOTHING;

-- KLIA / KLIA2 arrival checklist (idempotent)
INSERT INTO arrival_checklist_items (id, airport_code, stage, title, body, sort_order, estimated_minutes)
VALUES
('kul-immigration-mdac', 'KUL', 'immigration', 'Complete MDAC before passport control', 'Fill the Malaysia Digital Arrival Card (MDAC) online before you reach KLIA immigration. Have your passport, flight number, and Malaysian address ready. Follow signs for Arrivals / Immigration after leaving the aircraft.', 1, 10),
('kul-immigration-counters', 'KUL', 'immigration', 'Passport control at KLIA (main)', 'Join the foreign-passport queues unless you hold a Malaysian passport. Keep boarding pass and hotel address handy. Automated gates may be available for eligible passports; otherwise use a manned counter.', 2, 20),
('kul-baggage-carousel', 'KUL', 'baggage', 'Collect bags at the KLIA carousel', 'After immigration, follow Baggage Reclaim. Check screens for your flight number and carousel. Trolleys are free in the reclaim hall.', 1, 25),
('kul-baggage-lost', 'KUL', 'baggage', 'Report missing luggage', 'If your bag does not appear, go to the airline’s baggage services desk in the reclaim hall with your baggage tag and passport before leaving customs.', 2, 15),
('kul-customs-green-red', 'KUL', 'customs', 'Choose Green or Red Channel', 'Use the Green Channel if you have nothing to declare. Use Red if you carry dutiable goods, large amounts of cash, or restricted items. Keep receipts for new electronics if asked.', 1, 10),
('kul-sim-counters', 'KUL', 'sim', 'Buy a local SIM or eSIM after customs', 'Prepaid SIM and eSIM counters (CelcomDigi, Maxis, U Mobile, and kiosks) sit in the public arrivals hall after customs. Passport is required. eSIM can also be installed before you fly if you already purchased one.', 1, 15),
('kul-money-atm', 'KUL', 'money', 'Withdraw ringgit or exchange a little cash', 'ATMs and licensed money changers are in the KLIA arrivals hall. Withdraw a small amount of MYR for taxis or snacks; cards are widely accepted in the city. Compare rates before exchanging large sums.', 1, 10),
('kul-transport-ekspres', 'KUL', 'transport', 'KLIA Ekspres to KL Sentral', 'Non-stop train from KLIA (main) Level 1 to KL Sentral in about 28 minutes (~RM 55). Best when you want to skip highway traffic and your hotel is near Sentral or on city rail. Not door-to-door.', 1, 40),
('kul-transport-bus', 'KUL', 'transport', 'Airport bus (Aerobus / Jetbus)', 'Cheapest ride to KL Sentral (~RM 12–15, 60–75 minutes) from the ground-floor transportation hub. Use official counters. Best for budget travelers with light bags; skip if you have lots of luggage or a tight hotel check-in.', 2, 70),
('kul-transport-e-hail', 'KUL', 'transport', 'Grab, e-hailing, or coupon taxi', 'Door-to-hotel in about 50–65 minutes (~RM 65–85 plus toll). Book Grab or AirAsia Ride to the signed Level 1 pickup, or buy a prepaid coupon taxi inside the terminal. Do not follow touts. Best for families, groups, and heavy bags.', 3, 60),
('kul-transport-private', 'KUL', 'transport', 'Private transfer meet-and-greet', 'Pre-booked car waiting landside after customs. Use when you land late, travel with kids or mobility needs, or your hotel is awkward from KL Sentral. Confirm the booking says KLIA (main), not KLIA2. Costs more than Grab.', 4, 60),
('kul-first-steps-hotel', 'KUL', 'first_steps', 'Settle in: hotel, water, and emergency numbers', 'Confirm your hotel address in Grab or with the taxi desk. Tap water is not always recommended for visitors—buy bottled water. Save 999 for police/ambulance/fire and 03-2115 9999 for tourist police. Turn on mobile data once your SIM is active.', 1, 15),
('klia2-immigration-mdac', 'KLIA2', 'immigration', 'Complete MDAC, then KLIA2 immigration', 'Submit MDAC before landing if required. At KLIA2, follow Arrivals down to immigration. Low-cost terminals can be busy after evening AirAsia banks—keep passport and MDAC confirmation ready.', 1, 15),
('klia2-immigration-counters', 'KLIA2', 'immigration', 'Passport control at KLIA2', 'Use foreign-visitor lanes. After stamping, continue to baggage reclaim on the same level. Do not exit toward landside until you have cleared customs.', 2, 25),
('klia2-baggage-carousel', 'KLIA2', 'baggage', 'Find your KLIA2 carousel', 'Belt numbers are shown on screens in the KLIA2 reclaim hall. The hall is compact compared with main KLIA; trolleys are available near the belts.', 1, 20),
('klia2-baggage-lost', 'KLIA2', 'baggage', 'Airline baggage desk at KLIA2', 'Missing bag? Go to your airline’s desk (often AirAsia) in reclaim before customs. Photograph your baggage tag and keep boarding details.', 2, 15),
('klia2-customs-channel', 'KLIA2', 'customs', 'Clear KLIA2 customs', 'Walk through Green Channel with nothing to declare, or Red Channel for goods and large cash. You exit into the KLIA2 Gateway public hall.', 1, 10),
('klia2-sim-gateway', 'KLIA2', 'sim', 'SIM and eSIM in Gateway@klia2', 'After customs, SIM counters cluster in the Gateway mall / arrivals area. Compare prepaid tourist packs. Passport needed for registration. Wi-Fi is available while you wait.', 1, 15),
('klia2-money-atm', 'KLIA2', 'money', 'ATMs and changers in Gateway', 'ATMs and money changers sit in Gateway@klia2 after you leave customs. Withdraw MYR for the train or bus. Avoid unofficial changers outside the terminal.', 1, 10),
('klia2-transport-options', 'KLIA2', 'transport', 'KLIA Ekspres from Gateway@klia2', 'KLIA Ekspres and KLIA Transit stop at Gateway@klia2 Level 2 (about 33 minutes to KL Sentral). Best to beat traffic if you can manage bags on the train. Not a hotel drop-off.', 1, 45),
('klia2-transport-bus', 'KLIA2', 'transport', 'Airport bus from KLIA2', 'Aerobus / Jetbus from the KLIA2 transportation hub (~RM 12–15, 60–80 minutes to KL Sentral). Good for backpackers; less ideal after busy evening arrivals with bulky luggage.', 2, 75),
('klia2-transport-e-hail', 'KLIA2', 'transport', 'Grab, e-hailing, or coupon taxi at KLIA2', 'Door-to-hotel from marked kerbside pins (often Level 1 Door 5). Set the app to KLIA2, not main KLIA. Coupon taxi booths are indoors. Ignore touts. Best for families and several bags.', 3, 60),
('klia2-transport-private', 'KLIA2', 'transport', 'Private transfer at KLIA2', 'Meet-and-greet in the Gateway public hall. Book this for late AirAsia flights, groups, or limited walking. The voucher must say KLIA2 so the driver does not wait at the main terminal.', 4, 65),
('klia2-first-steps', 'KLIA2', 'first_steps', 'Hotel, water, data, emergencies', 'Share the KLIA2 pin with your driver (it is a different terminal from main KLIA). Buy water in Gateway. Enable data, and save 999 plus tourist police 03-2115 9999.', 1, 15)
ON CONFLICT (id) DO UPDATE SET
  airport_code = EXCLUDED.airport_code,
  stage = EXCLUDED.stage,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  sort_order = EXCLUDED.sort_order,
  estimated_minutes = EXCLUDED.estimated_minutes;
