/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN password_hash TEXT;

    CREATE TABLE password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash)
    );

    CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS password_reset_tokens;
    ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
  `);
};
