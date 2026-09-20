/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE arrival_checklist_items (
      id TEXT PRIMARY KEY,
      airport_code TEXT NOT NULL,
      stage TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      estimated_minutes INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT arrival_checklist_airport_valid CHECK (
        airport_code IN ('KUL', 'KLIA2')
      ),
      CONSTRAINT arrival_checklist_stage_valid CHECK (
        stage IN (
          'immigration',
          'baggage',
          'customs',
          'sim',
          'money',
          'transport',
          'first_steps'
        )
      ),
      CONSTRAINT arrival_checklist_sort_nonneg CHECK (sort_order >= 0),
      CONSTRAINT arrival_checklist_minutes_positive CHECK (
        estimated_minutes IS NULL OR estimated_minutes > 0
      )
    );

    CREATE INDEX arrival_checklist_items_airport_stage_idx
      ON arrival_checklist_items (airport_code, stage, sort_order);

    CREATE TRIGGER arrival_checklist_items_set_updated_at
      BEFORE UPDATE ON arrival_checklist_items
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS arrival_checklist_items_set_updated_at ON arrival_checklist_items;
    DROP TABLE IF EXISTS arrival_checklist_items;
  `);
};
