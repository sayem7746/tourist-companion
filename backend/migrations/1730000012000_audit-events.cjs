/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      summary TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      actor_type TEXT NOT NULL,
      actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
      actor_email TEXT,
      request_id TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT audit_events_action_valid CHECK (
        action IN (
          'partner.create',
          'partner.update',
          'partner.delete',
          'partner.approve',
          'partner.pause',
          'content.publish',
          'content.unpublish',
          'faq.publish',
          'faq.unpublish'
        )
      ),
      CONSTRAINT audit_events_entity_type_valid CHECK (
        entity_type IN ('partner', 'content', 'faq')
      ),
      CONSTRAINT audit_events_actor_type_valid CHECK (
        actor_type IN ('admin_jwt', 'admin_token')
      ),
      CONSTRAINT audit_events_summary_present CHECK (char_length(btrim(summary)) > 0),
      CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
    );

    CREATE INDEX audit_events_created_at_idx ON audit_events (created_at DESC);
    CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id);
    CREATE INDEX audit_events_action_idx ON audit_events (action);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS audit_events_action_idx;
    DROP INDEX IF EXISTS audit_events_entity_idx;
    DROP INDEX IF EXISTS audit_events_created_at_idx;
    DROP TABLE IF EXISTS audit_events;
  `);
};
