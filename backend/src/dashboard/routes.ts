import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/middleware.js';
import type { AuthStore } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { PartnerStore } from '../partners/types.js';
import type { TripStore } from '../trips/types.js';
import { buildOpsDashboard } from './snapshot.js';

export async function registerDashboardRoutes(
  app: FastifyInstance,
  config: AppConfig,
  deps: {
    resolveAuthStore: () => AuthStore | undefined;
    resolveTripStore: () => TripStore | undefined;
    resolvePartnerStore: () => PartnerStore | undefined;
  },
): Promise<void> {
  app.get('/admin/dashboard', { preHandler: requireAdmin(config) }, async () => {
    const authStore = deps.resolveAuthStore();
    const tripStore = deps.resolveTripStore();
    const partnerStore = deps.resolvePartnerStore();

    const [users, trips, referrals] = await Promise.all([
      authStore?.count(),
      tripStore?.count(),
      partnerStore?.getReferralAnalytics().then((analytics) => analytics.totals.referrals),
    ]);

    return {
      dashboard: buildOpsDashboard({
        users,
        trips,
        referrals,
        metrics: app.metrics.snapshot(),
      }),
    };
  });
}
