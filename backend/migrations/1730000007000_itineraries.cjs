/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE itineraries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
      day_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      generated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT itineraries_trip_id_unique UNIQUE (trip_id),
      CONSTRAINT itineraries_day_count_valid CHECK (day_count BETWEEN 1 AND 7),
      CONSTRAINT itineraries_status_valid CHECK (status IN ('draft', 'active', 'archived'))
    );

    CREATE TABLE itinerary_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      itinerary_id UUID NOT NULL REFERENCES itineraries (id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT itinerary_days_number_valid CHECK (day_number BETWEEN 1 AND 7),
      CONSTRAINT itinerary_days_itinerary_number_unique UNIQUE (itinerary_id, day_number),
      CONSTRAINT itinerary_days_itinerary_date_unique UNIQUE (itinerary_id, date)
    );

    CREATE TABLE itinerary_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      day_id UUID NOT NULL REFERENCES itinerary_days (id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      place_id TEXT,
      travel_time_minutes INTEGER,
      notes TEXT,
      booking_url TEXT,
      referral_partner_id UUID REFERENCES providers (id) ON DELETE SET NULL,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT itinerary_items_kind_valid CHECK (kind IN ('activity', 'meal', 'travel', 'note')),
      CONSTRAINT itinerary_items_time_format CHECK (
        start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      ),
      CONSTRAINT itinerary_items_time_order CHECK (end_time > start_time),
      CONSTRAINT itinerary_items_travel_minutes_valid CHECK (
        travel_time_minutes IS NULL OR travel_time_minutes >= 0
      ),
      CONSTRAINT itinerary_items_booking_https CHECK (
        booking_url IS NULL OR booking_url ~ '^https://'
      )
    );

    CREATE INDEX itinerary_days_itinerary_id_idx ON itinerary_days (itinerary_id);
    CREATE INDEX itinerary_items_day_id_idx ON itinerary_items (day_id);
    CREATE INDEX itinerary_items_referral_partner_id_idx ON itinerary_items (referral_partner_id);

    CREATE TRIGGER itineraries_set_updated_at
      BEFORE UPDATE ON itineraries
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER itinerary_days_set_updated_at
      BEFORE UPDATE ON itinerary_days
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER itinerary_items_set_updated_at
      BEFORE UPDATE ON itinerary_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS itinerary_items_set_updated_at ON itinerary_items;
    DROP TRIGGER IF EXISTS itinerary_days_set_updated_at ON itinerary_days;
    DROP TRIGGER IF EXISTS itineraries_set_updated_at ON itineraries;
    DROP TABLE IF EXISTS itinerary_items;
    DROP TABLE IF EXISTS itinerary_days;
    DROP TABLE IF EXISTS itineraries;
  `);
};
