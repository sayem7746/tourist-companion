/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE trips
      ADD COLUMN adult_count INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN child_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN interests TEXT[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN daily_budget TEXT,
      ADD COLUMN travel_style TEXT,
      ADD COLUMN accommodation_name TEXT,
      ADD COLUMN arrival_airport TEXT,
      ADD COLUMN arrival_flight TEXT,
      ADD COLUMN arrival_at TIMESTAMPTZ;

    ALTER TABLE trips
      ADD CONSTRAINT trips_adult_count_valid CHECK (adult_count >= 1),
      ADD CONSTRAINT trips_child_count_valid CHECK (child_count >= 0),
      ADD CONSTRAINT trips_daily_budget_valid CHECK (
        daily_budget IS NULL OR daily_budget IN ('low', 'medium', 'high')
      ),
      ADD CONSTRAINT trips_travel_style_valid CHECK (
        travel_style IS NULL OR travel_style IN ('relaxed', 'balanced', 'packed')
      );

    ALTER TABLE trips DROP CONSTRAINT trips_dates_valid;
    ALTER TABLE trips ADD CONSTRAINT trips_dates_valid CHECK (end_date > start_date);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE trips DROP CONSTRAINT trips_dates_valid;
    ALTER TABLE trips ADD CONSTRAINT trips_dates_valid CHECK (end_date >= start_date);

    ALTER TABLE trips
      DROP CONSTRAINT IF EXISTS trips_travel_style_valid,
      DROP CONSTRAINT IF EXISTS trips_daily_budget_valid,
      DROP CONSTRAINT IF EXISTS trips_child_count_valid,
      DROP CONSTRAINT IF EXISTS trips_adult_count_valid;

    ALTER TABLE trips
      DROP COLUMN IF EXISTS arrival_at,
      DROP COLUMN IF EXISTS arrival_flight,
      DROP COLUMN IF EXISTS arrival_airport,
      DROP COLUMN IF EXISTS accommodation_name,
      DROP COLUMN IF EXISTS travel_style,
      DROP COLUMN IF EXISTS daily_budget,
      DROP COLUMN IF EXISTS interests,
      DROP COLUMN IF EXISTS child_count,
      DROP COLUMN IF EXISTS adult_count;
  `);
};
