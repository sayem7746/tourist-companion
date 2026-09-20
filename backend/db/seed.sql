-- Idempotent development seed. Prefer `npm run db:seed` which wraps this in a transaction.
-- Safe to re-run: unique email/slug/referral_code and ON CONFLICT guards.

INSERT INTO users (email, display_name)
VALUES ('demo@tourist-companion.local', 'Demo Traveller')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

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

INSERT INTO providers (name, slug, category, website, contact_email, commission_rate, is_active)
VALUES (
  'Grab Malaysia',
  'grab-malaysia',
  'transport',
  'https://www.grab.com/my/',
  'partners@example.com',
  0.0500,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  website = EXCLUDED.website;

INSERT INTO trip_places (trip_id, place_id, sort_order, notes)
SELECT t.id, p.id, 0, 'Arrival checkpoint'
FROM trips t
JOIN users u ON u.id = t.user_id
JOIN places p ON p.name = 'KLIA Terminal 1'
WHERE u.email = 'demo@tourist-companion.local'
  AND t.destination = 'Kuala Lumpur'
ON CONFLICT (trip_id, place_id) DO NOTHING;

INSERT INTO referrals (user_id, trip_id, provider_id, place_id, referral_code, status, metadata)
SELECT
  u.id,
  t.id,
  pr.id,
  pl.id,
  'DEMO-GRAB-001',
  'pending',
  '{"channel": "seed"}'::jsonb
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
('kul-transport-ekspres', 'KUL', 'transport', 'KLIA Ekspres, bus, Grab, or taxi', 'KLIA Ekspres trains run from KLIA to KL Sentral (about 28 minutes). Buses and licensed airport taxis leave from the ground-transport level. Grab pickup is signed in the arrivals forecourt—confirm the pin in the app before you walk out.', 1, 40),
('kul-first-steps-hotel', 'KUL', 'first_steps', 'Settle in: hotel, water, and emergency numbers', 'Confirm your hotel address in Grab or with the taxi desk. Tap water is not always recommended for visitors—buy bottled water. Save 999 for police/ambulance/fire and 03-2115 9999 for tourist police. Turn on mobile data once your SIM is active.', 1, 15),
('klia2-immigration-mdac', 'KLIA2', 'immigration', 'Complete MDAC, then KLIA2 immigration', 'Submit MDAC before landing if required. At KLIA2, follow Arrivals down to immigration. Low-cost terminals can be busy after evening AirAsia banks—keep passport and MDAC confirmation ready.', 1, 15),
('klia2-immigration-counters', 'KLIA2', 'immigration', 'Passport control at KLIA2', 'Use foreign-visitor lanes. After stamping, continue to baggage reclaim on the same level. Do not exit toward landside until you have cleared customs.', 2, 25),
('klia2-baggage-carousel', 'KLIA2', 'baggage', 'Find your KLIA2 carousel', 'Belt numbers are shown on screens in the KLIA2 reclaim hall. The hall is compact compared with main KLIA; trolleys are available near the belts.', 1, 20),
('klia2-baggage-lost', 'KLIA2', 'baggage', 'Airline baggage desk at KLIA2', 'Missing bag? Go to your airline’s desk (often AirAsia) in reclaim before customs. Photograph your baggage tag and keep boarding details.', 2, 15),
('klia2-customs-channel', 'KLIA2', 'customs', 'Clear KLIA2 customs', 'Walk through Green Channel with nothing to declare, or Red Channel for goods and large cash. You exit into the KLIA2 Gateway public hall.', 1, 10),
('klia2-sim-gateway', 'KLIA2', 'sim', 'SIM and eSIM in Gateway@klia2', 'After customs, SIM counters cluster in the Gateway mall / arrivals area. Compare prepaid tourist packs. Passport needed for registration. Wi-Fi is available while you wait.', 1, 15),
('klia2-money-atm', 'KLIA2', 'money', 'ATMs and changers in Gateway', 'ATMs and money changers sit in Gateway@klia2 after you leave customs. Withdraw MYR for the train or bus. Avoid unofficial changers outside the terminal.', 1, 10),
('klia2-transport-options', 'KLIA2', 'transport', 'KLIA Ekspres from KLIA2, bus, Grab, taxi', 'KLIA Ekspres and KLIA Transit stop at KLIA2 (Gateway). Follow signs upstairs to the station. Buses use the transportation hub; Grab pickup points are marked on the kerbside—do not follow touts.', 1, 45),
('klia2-first-steps', 'KLIA2', 'first_steps', 'Hotel, water, data, emergencies', 'Share the KLIA2 pin with your driver (it is a different terminal from main KLIA). Buy water in Gateway. Enable data, and save 999 plus tourist police 03-2115 9999.', 1, 15)
ON CONFLICT (id) DO UPDATE SET
  airport_code = EXCLUDED.airport_code,
  stage = EXCLUDED.stage,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  sort_order = EXCLUDED.sort_order,
  estimated_minutes = EXCLUDED.estimated_minutes;
