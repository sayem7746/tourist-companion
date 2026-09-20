/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // 8–14 is a transient staging range so alignDays can bump day_number off 1–7
  // before assigning the final permutation (avoids itinerary_days_itinerary_number_unique).
  pgm.sql(`
    ALTER TABLE itinerary_days DROP CONSTRAINT itinerary_days_number_valid;
    ALTER TABLE itinerary_days ADD CONSTRAINT itinerary_days_number_valid
      CHECK (day_number BETWEEN 1 AND 14);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE itinerary_days DROP CONSTRAINT itinerary_days_number_valid;
    ALTER TABLE itinerary_days ADD CONSTRAINT itinerary_days_number_valid
      CHECK (day_number BETWEEN 1 AND 7);
  `);
};
