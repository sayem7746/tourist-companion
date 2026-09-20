-- Idempotent development seed. Prefer `npm run db:seed` which wraps this in a transaction.
-- Safe to re-run: unique email/slug/referral_code and ON CONFLICT guards.

INSERT INTO users (email, display_name)
VALUES ('demo@tourist-companion.local', 'Demo Traveller')
ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name;

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
