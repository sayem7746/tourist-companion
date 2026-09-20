import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type DashboardMetricSource = 'store' | 'metrics';

export interface OpsDashboard {
  users: number;
  trips: number;
  conciergeUsage: number;
  nearbySearches: number;
  referrals: number;
  errors: number;
  sources?: {
    users: DashboardMetricSource;
    trips: DashboardMetricSource;
    conciergeUsage: DashboardMetricSource;
    nearbySearches: DashboardMetricSource;
    referrals: DashboardMetricSource;
    errors: DashboardMetricSource;
  };
}

export interface DashboardCard {
  key: keyof Omit<OpsDashboard, 'sources'>;
  label: string;
  value: number;
  hint: string;
  alert: boolean;
}

const CARD_COPY: Array<{
  key: DashboardCard['key'];
  label: string;
  hint: string;
}> = [
  { key: 'users', label: 'Users', hint: 'Accounts on record' },
  { key: 'trips', label: 'Trips', hint: 'Trips on record' },
  { key: 'conciergeUsage', label: 'Concierge', hint: 'Chat requests this process' },
  { key: 'nearbySearches', label: 'Nearby', hint: 'Nearby searches this process' },
  { key: 'referrals', label: 'Referrals', hint: 'Referral records' },
  { key: 'errors', label: 'Errors', hint: 'HTTP 4xx/5xx this process' },
];

export function dashboardCards(dashboard: OpsDashboard): DashboardCard[] {
  return CARD_COPY.map((card) => ({
    ...card,
    value: dashboard[card.key],
    alert: card.key === 'errors' && dashboard.errors > 0,
  }));
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/admin/dashboard`;

  get(): Observable<{ dashboard: OpsDashboard }> {
    return this.http.get<{ dashboard: OpsDashboard }>(this.url, { withCredentials: true });
  }
}
