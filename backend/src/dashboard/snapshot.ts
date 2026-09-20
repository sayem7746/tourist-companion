import { routeCount, type MetricsSnapshot } from '../observability/metrics.js';

export const DASHBOARD_METRIC_ROUTES = {
  users: { method: 'POST', path: '/auth/signup' },
  trips: { method: 'POST', path: '/trips' },
  conciergeUsage: { method: 'POST', path: '/concierge/chat' },
  nearbySearches: { method: 'GET', path: '/places/nearby' },
  referrals: { method: 'POST', path: '/referrals/clicks' },
} as const;

export type DashboardMetricSource = 'store' | 'metrics';

export type OpsDashboardCounts = {
  users: number;
  trips: number;
  conciergeUsage: number;
  nearbySearches: number;
  referrals: number;
  errors: number;
};

export type OpsDashboardSources = {
  [K in keyof OpsDashboardCounts]: DashboardMetricSource;
};

export interface OpsDashboard extends OpsDashboardCounts {
  sources: OpsDashboardSources;
}

function fromStoreOrMetrics(
  stored: number | undefined,
  metrics: MetricsSnapshot,
  route: { method: string; path: string },
): { count: number; source: DashboardMetricSource } {
  if (stored !== undefined) {
    return { count: stored, source: 'store' };
  }
  return { count: routeCount(metrics, route.method, route.path), source: 'metrics' };
}

export function buildOpsDashboard(input: {
  users?: number;
  trips?: number;
  referrals?: number;
  metrics: MetricsSnapshot;
}): OpsDashboard {
  const users = fromStoreOrMetrics(input.users, input.metrics, DASHBOARD_METRIC_ROUTES.users);
  const trips = fromStoreOrMetrics(input.trips, input.metrics, DASHBOARD_METRIC_ROUTES.trips);
  const referrals = fromStoreOrMetrics(
    input.referrals,
    input.metrics,
    DASHBOARD_METRIC_ROUTES.referrals,
  );

  return {
    users: users.count,
    trips: trips.count,
    conciergeUsage: routeCount(
      input.metrics,
      DASHBOARD_METRIC_ROUTES.conciergeUsage.method,
      DASHBOARD_METRIC_ROUTES.conciergeUsage.path,
    ),
    nearbySearches: routeCount(
      input.metrics,
      DASHBOARD_METRIC_ROUTES.nearbySearches.method,
      DASHBOARD_METRIC_ROUTES.nearbySearches.path,
    ),
    referrals: referrals.count,
    errors: input.metrics.errorsTotal,
    sources: {
      users: users.source,
      trips: trips.source,
      conciergeUsage: 'metrics',
      nearbySearches: 'metrics',
      referrals: referrals.source,
      errors: 'metrics',
    },
  };
}
