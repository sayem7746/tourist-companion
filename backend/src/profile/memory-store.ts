import type { AuthStore } from '../auth/types.js';
import type {
  DietaryPreference,
  MobilityNeed,
  ProfilePreferencesPatch,
  ProfileStore,
  TouristProfile,
  TravelStyle,
} from './types.js';

interface StoredPrefs {
  language: string;
  dietaryPreferences: DietaryPreference[];
  mobilityNeeds: MobilityNeed[];
  travelStyle: TravelStyle | null;
}

const defaults = (): StoredPrefs => ({
  language: 'en',
  dietaryPreferences: [],
  mobilityNeeds: [],
  travelStyle: null,
});

export function createMemoryProfileStore(authStore: AuthStore): ProfileStore {
  const prefsByUserId = new Map<string, StoredPrefs>();

  const assemble = async (userId: string, prefs: StoredPrefs): Promise<TouristProfile | undefined> => {
    const user = await authStore.findById(userId);
    if (!user) return undefined;
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      language: prefs.language,
      dietaryPreferences: prefs.dietaryPreferences,
      mobilityNeeds: prefs.mobilityNeeds,
      travelStyle: prefs.travelStyle,
    };
  };

  return {
    async getOrCreate(userId) {
      let prefs = prefsByUserId.get(userId);
      if (!prefs) {
        prefs = defaults();
        prefsByUserId.set(userId, prefs);
      }
      return assemble(userId, prefs);
    },
    async update(userId, patch) {
      const user = await authStore.findById(userId);
      if (!user) return undefined;
      if (patch.displayName && patch.displayName !== user.displayName) {
        user.displayName = patch.displayName;
      }
      const current = prefsByUserId.get(userId) ?? defaults();
      const next: StoredPrefs = {
        language: patch.language ?? current.language,
        dietaryPreferences: patch.dietaryPreferences ?? current.dietaryPreferences,
        mobilityNeeds: patch.mobilityNeeds ?? current.mobilityNeeds,
        travelStyle:
          patch.travelStyle === undefined ? current.travelStyle : patch.travelStyle,
      };
      prefsByUserId.set(userId, next);
      return assemble(userId, next);
    },
  };
}
