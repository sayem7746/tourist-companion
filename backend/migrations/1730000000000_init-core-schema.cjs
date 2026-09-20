/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_email_unique UNIQUE (email),
      CONSTRAINT users_email_format CHECK (position('@' IN email) > 1)
    );

    CREATE TABLE trips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      destination TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT trips_dates_valid CHECK (end_date >= start_date),
      CONSTRAINT trips_status_valid CHECK (status IN ('draft', 'active', 'completed', 'cancelled'))
    );

    CREATE TABLE places (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      address TEXT,
      city TEXT,
      country TEXT NOT NULL DEFAULT 'MY',
      latitude NUMERIC(9, 6),
      longitude NUMERIC(9, 6),
      external_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT places_category_valid CHECK (
        category IN ('airport', 'attraction', 'food', 'lodging', 'transport', 'shopping', 'safety', 'other')
      )
    );

    CREATE TABLE trip_places (
      trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
      place_id UUID NOT NULL REFERENCES places (id) ON DELETE CASCADE,
      visit_date DATE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (trip_id, place_id)
    );

    CREATE TABLE providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT NOT NULL,
      website TEXT,
      contact_email TEXT,
      commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT providers_slug_unique UNIQUE (slug),
      CONSTRAINT providers_category_valid CHECK (
        category IN ('transport', 'lodging', 'activity', 'sim', 'insurance', 'other')
      ),
      CONSTRAINT providers_commission_valid CHECK (commission_rate >= 0 AND commission_rate <= 1)
    );

    CREATE TABLE referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      trip_id UUID REFERENCES trips (id) ON DELETE SET NULL,
      provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE RESTRICT,
      place_id UUID REFERENCES places (id) ON DELETE SET NULL,
      referral_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      converted_at TIMESTAMPTZ,
      CONSTRAINT referrals_code_unique UNIQUE (referral_code),
      CONSTRAINT referrals_status_valid CHECK (status IN ('pending', 'clicked', 'converted', 'expired'))
    );

    CREATE INDEX trips_user_id_idx ON trips (user_id);
    CREATE INDEX trips_start_date_idx ON trips (start_date);
    CREATE INDEX places_category_idx ON places (category);
    CREATE INDEX places_city_idx ON places (city);
    CREATE INDEX trip_places_place_id_idx ON trip_places (place_id);
    CREATE INDEX providers_active_idx ON providers (is_active);
    CREATE INDEX referrals_user_id_idx ON referrals (user_id);
    CREATE INDEX referrals_provider_id_idx ON referrals (provider_id);
    CREATE INDEX referrals_status_idx ON referrals (status);

    CREATE TRIGGER users_set_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER trips_set_updated_at
      BEFORE UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER places_set_updated_at
      BEFORE UPDATE ON places
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER providers_set_updated_at
      BEFORE UPDATE ON providers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS providers_set_updated_at ON providers;
    DROP TRIGGER IF EXISTS places_set_updated_at ON places;
    DROP TRIGGER IF EXISTS trips_set_updated_at ON trips;
    DROP TRIGGER IF EXISTS users_set_updated_at ON users;
    DROP TABLE IF EXISTS referrals;
    DROP TABLE IF EXISTS trip_places;
    DROP TABLE IF EXISTS providers;
    DROP TABLE IF EXISTS places;
    DROP TABLE IF EXISTS trips;
    DROP TABLE IF EXISTS users;
    DROP FUNCTION IF EXISTS set_updated_at();
  `);
};
