/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE content_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}'::text[],
      area TEXT,
      airport_code TEXT,
      topic TEXT,
      when_to_use TEXT,
      icon TEXT,
      steps TEXT[] NOT NULL DEFAULT '{}'::text[],
      sort_order INTEGER NOT NULL DEFAULT 0,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT content_items_slug_unique UNIQUE (slug),
      CONSTRAINT content_items_slug_format CHECK (
        slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      ),
      CONSTRAINT content_items_kind_valid CHECK (
        kind IN ('arrival_guide', 'faq', 'etiquette', 'payment', 'safety')
      ),
      CONSTRAINT content_items_title_present CHECK (char_length(btrim(title)) > 0),
      CONSTRAINT content_items_body_present CHECK (char_length(btrim(body)) > 0),
      CONSTRAINT content_items_sort_nonneg CHECK (sort_order >= 0),
      CONSTRAINT content_items_airport_valid CHECK (
        airport_code IS NULL OR airport_code IN ('KUL', 'KLIA2')
      )
    );

    CREATE INDEX content_items_kind_published_idx
      ON content_items (kind, published, sort_order);

    CREATE TRIGGER content_items_set_updated_at
      BEFORE UPDATE ON content_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS content_items_set_updated_at ON content_items;
    DROP INDEX IF EXISTS content_items_kind_published_idx;
    DROP TABLE IF EXISTS content_items;
  `);
};
