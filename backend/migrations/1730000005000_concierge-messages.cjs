/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE concierge_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      trip_id UUID NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT concierge_messages_role_valid CHECK (role IN ('user', 'assistant')),
      CONSTRAINT concierge_messages_content_len CHECK (char_length(content) BETWEEN 1 AND 2000),
      CONSTRAINT concierge_messages_conversation_len CHECK (
        char_length(conversation_id) BETWEEN 8 AND 80
      ),
      CONSTRAINT concierge_messages_expires_after_created CHECK (expires_at > created_at)
    );

    CREATE INDEX concierge_messages_trip_created_idx
      ON concierge_messages (user_id, trip_id, created_at);

    CREATE INDEX concierge_messages_expires_at_idx
      ON concierge_messages (expires_at);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS concierge_messages;
  `);
};
