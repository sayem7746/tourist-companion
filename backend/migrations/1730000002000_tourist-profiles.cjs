/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE tourist_profiles (
      user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
      language TEXT NOT NULL DEFAULT 'en',
      dietary_preferences TEXT[] NOT NULL DEFAULT '{}'::text[],
      mobility_needs TEXT[] NOT NULL DEFAULT '{}'::text[],
      travel_style TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tourist_profiles_language_len CHECK (
        char_length(language) BETWEEN 2 AND 16
      ),
      CONSTRAINT tourist_profiles_travel_style_valid CHECK (
        travel_style IS NULL OR travel_style IN ('relaxed', 'balanced', 'packed')
      )
    );

    CREATE TRIGGER tourist_profiles_set_updated_at
      BEFORE UPDATE ON tourist_profiles
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS tourist_profiles_set_updated_at ON tourist_profiles;
    DROP TABLE IF EXISTS tourist_profiles;
  `);
};
