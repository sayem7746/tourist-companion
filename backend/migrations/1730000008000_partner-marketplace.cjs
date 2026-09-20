/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE providers DROP CONSTRAINT providers_category_valid;

    UPDATE providers SET category = CASE category
      WHEN 'transport' THEN 'transfers'
      WHEN 'lodging' THEN 'hotels'
      WHEN 'activity' THEN 'tours'
      ELSE category
    END;

    UPDATE providers
      SET is_active = FALSE
      WHERE category IN ('insurance', 'other');

    UPDATE providers
      SET category = 'tourist_services'
      WHERE category IN ('insurance', 'other');

    ALTER TABLE providers
      ADD COLUMN listing_summary TEXT NOT NULL DEFAULT '',
      ADD COLUMN listing_city TEXT,
      ADD COLUMN listing_area TEXT,
      ADD COLUMN booking_url TEXT,
      ADD COLUMN disclosure TEXT NOT NULL DEFAULT
        'We may earn a commission if you book or buy through this link.',
      ADD COLUMN sponsored BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN license_name TEXT,
      ADD COLUMN license_id TEXT,
      ADD COLUMN typical_myr TEXT,
      ADD COLUMN languages TEXT[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN listing_extras JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN commission_basis TEXT NOT NULL DEFAULT 'booking',
      ADD COLUMN commission_currency TEXT NOT NULL DEFAULT 'MYR';

    UPDATE providers
      SET listing_summary = name
      WHERE is_active AND char_length(btrim(listing_summary)) = 0;

    UPDATE providers SET
      listing_summary = 'Licensed e-hailing rides across Malaysia, including airport pickup at KLIA and KLIA2.',
      listing_city = 'Kuala Lumpur',
      listing_area = 'KLIA / KLIA2',
      booking_url = 'https://www.grab.com/my/',
      disclosure = 'We may earn a commission if you book or buy through this link.',
      sponsored = FALSE,
      languages = ARRAY['en', 'ms']::text[],
      listing_extras = jsonb_build_object(
        'vehicleClass', 'car',
        'airportCodes', jsonb_build_array('KUL', 'KLIA2'),
        'meetAndGreet', false
      ),
      commission_basis = 'booking'
    WHERE slug = 'grab-malaysia';

    UPDATE providers SET commission_basis = 'activation' WHERE category = 'sim';

    ALTER TABLE providers
      ADD CONSTRAINT providers_category_valid CHECK (
        category IN ('hotels', 'transfers', 'tours', 'sim', 'restaurants', 'tourist_services')
      ),
      ADD CONSTRAINT providers_commission_basis_valid CHECK (
        commission_basis IN ('booking', 'click', 'activation')
      ),
      ADD CONSTRAINT providers_commission_currency_valid CHECK (commission_currency = 'MYR'),
      ADD CONSTRAINT providers_booking_https CHECK (
        booking_url IS NULL OR booking_url ~ '^https://'
      ),
      ADD CONSTRAINT providers_website_https CHECK (
        website IS NULL OR website ~ '^https://'
      ),
      ADD CONSTRAINT providers_contact_email_format CHECK (
        contact_email IS NULL OR position('@' IN contact_email) > 1
      ),
      ADD CONSTRAINT providers_listing_extras_object CHECK (jsonb_typeof(listing_extras) = 'object'),
      ADD CONSTRAINT providers_active_summary CHECK (
        NOT is_active OR char_length(btrim(listing_summary)) > 0
      ),
      ADD CONSTRAINT providers_disclosure_present CHECK (char_length(btrim(disclosure)) > 0);

    CREATE INDEX providers_category_idx ON providers (category) WHERE is_active;

    ALTER TABLE referrals
      ADD COLUMN channel TEXT,
      ADD COLUMN itinerary_item_id UUID REFERENCES itinerary_items (id) ON DELETE SET NULL;

    UPDATE referrals SET channel = 'arrival'
    WHERE referral_code = 'DEMO-GRAB-001' AND channel IS NULL;

    ALTER TABLE referrals
      ADD CONSTRAINT referrals_channel_valid CHECK (
        channel IS NULL OR channel IN (
          'itinerary',
          'arrival',
          'explore',
          'concierge',
          'dashboard'
        )
      );

    CREATE INDEX referrals_channel_idx ON referrals (channel);
    CREATE INDEX referrals_itinerary_item_id_idx ON referrals (itinerary_item_id);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS referrals_itinerary_item_id_idx;
    DROP INDEX IF EXISTS referrals_channel_idx;

    ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_channel_valid;
    ALTER TABLE referrals DROP COLUMN IF EXISTS itinerary_item_id;
    ALTER TABLE referrals DROP COLUMN IF EXISTS channel;

    DROP INDEX IF EXISTS providers_category_idx;

    ALTER TABLE providers
      DROP CONSTRAINT IF EXISTS providers_disclosure_present,
      DROP CONSTRAINT IF EXISTS providers_active_summary,
      DROP CONSTRAINT IF EXISTS providers_listing_extras_object,
      DROP CONSTRAINT IF EXISTS providers_contact_email_format,
      DROP CONSTRAINT IF EXISTS providers_website_https,
      DROP CONSTRAINT IF EXISTS providers_booking_https,
      DROP CONSTRAINT IF EXISTS providers_commission_currency_valid,
      DROP CONSTRAINT IF EXISTS providers_commission_basis_valid,
      DROP CONSTRAINT IF EXISTS providers_category_valid;

    ALTER TABLE providers
      DROP COLUMN IF EXISTS commission_currency,
      DROP COLUMN IF EXISTS commission_basis,
      DROP COLUMN IF EXISTS listing_extras,
      DROP COLUMN IF EXISTS languages,
      DROP COLUMN IF EXISTS typical_myr,
      DROP COLUMN IF EXISTS license_id,
      DROP COLUMN IF EXISTS license_name,
      DROP COLUMN IF EXISTS sponsored,
      DROP COLUMN IF EXISTS disclosure,
      DROP COLUMN IF EXISTS booking_url,
      DROP COLUMN IF EXISTS listing_area,
      DROP COLUMN IF EXISTS listing_city,
      DROP COLUMN IF EXISTS listing_summary;

    UPDATE providers SET category = CASE category
      WHEN 'transfers' THEN 'transport'
      WHEN 'hotels' THEN 'lodging'
      WHEN 'tours' THEN 'activity'
      WHEN 'restaurants' THEN 'other'
      WHEN 'tourist_services' THEN 'other'
      ELSE category
    END;

    ALTER TABLE providers
      ADD CONSTRAINT providers_category_valid CHECK (
        category IN ('transport', 'lodging', 'activity', 'sim', 'insurance', 'other')
      );
  `);
};
