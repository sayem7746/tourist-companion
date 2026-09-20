import type pg from 'pg';
import type {
  DietaryPreference,
  MobilityNeed,
  ProfilePreferencesPatch,
  ProfileStore,
  TouristProfile,
  TravelStyle,
} from './types.js';

interface ProfileRow {
  userId: string;
  email: string;
  displayName: string;
  language: string;
  dietaryPreferences: DietaryPreference[];
  mobilityNeeds: MobilityNeed[];
  travelStyle: TravelStyle | null;
}

const SELECT_PROFILE = `
  SELECT
    u.id AS "userId",
    u.email,
    u.display_name AS "displayName",
    p.language,
    p.dietary_preferences AS "dietaryPreferences",
    p.mobility_needs AS "mobilityNeeds",
    p.travel_style AS "travelStyle"
  FROM users u
  JOIN tourist_profiles p ON p.user_id = u.id
  WHERE u.id = $1
`;

export function createPgProfileStore(pool: pg.Pool): ProfileStore {
  return {
    async getOrCreate(userId) {
      const existing = await pool.query<ProfileRow>(SELECT_PROFILE, [userId]);
      if (existing.rows[0]) {
        return existing.rows[0];
      }

      const user = await pool.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
      if (!user.rows[0]) {
        return undefined;
      }

      await pool.query(
        `INSERT INTO tourist_profiles (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );
      const created = await pool.query<ProfileRow>(SELECT_PROFILE, [userId]);
      return created.rows[0];
    },
    async update(userId, patch) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const user = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE id = $1 FOR UPDATE',
          [userId],
        );
        if (!user.rows[0]) {
          await client.query('ROLLBACK');
          return undefined;
        }

        if (patch.displayName) {
          await client.query('UPDATE users SET display_name = $1 WHERE id = $2', [
            patch.displayName,
            userId,
          ]);
        }

        await client.query(
          `INSERT INTO tourist_profiles (user_id)
           VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId],
        );

        const sets: string[] = [];
        const values: unknown[] = [];
        let i = 1;

        if (patch.language !== undefined) {
          sets.push(`language = $${i++}`);
          values.push(patch.language);
        }
        if (patch.dietaryPreferences !== undefined) {
          sets.push(`dietary_preferences = $${i++}`);
          values.push(patch.dietaryPreferences);
        }
        if (patch.mobilityNeeds !== undefined) {
          sets.push(`mobility_needs = $${i++}`);
          values.push(patch.mobilityNeeds);
        }
        if (patch.travelStyle !== undefined) {
          sets.push(`travel_style = $${i++}`);
          values.push(patch.travelStyle);
        }

        if (sets.length > 0) {
          values.push(userId);
          await client.query(
            `UPDATE tourist_profiles SET ${sets.join(', ')} WHERE user_id = $${i}`,
            values,
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const result = await pool.query<ProfileRow>(SELECT_PROFILE, [userId]);
      return result.rows[0];
    },
  };
}
