/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN role TEXT NOT NULL DEFAULT 'tourist',
      ADD CONSTRAINT users_role_valid CHECK (role IN ('tourist', 'admin'));
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_valid;
    ALTER TABLE users DROP COLUMN IF EXISTS role;
  `);
};
