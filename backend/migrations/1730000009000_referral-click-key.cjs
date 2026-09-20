/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX referrals_user_click_key_idx
      ON referrals (user_id, (metadata->>'clickKey'))
      WHERE COALESCE(metadata->>'clickKey', '') <> '';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS referrals_user_click_key_idx;
  `);
};
