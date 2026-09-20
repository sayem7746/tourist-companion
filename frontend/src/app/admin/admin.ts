import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, type AuthUser } from '../auth/auth.service';
import {
  DashboardService,
  dashboardCards,
  type DashboardCard,
  type OpsDashboard,
} from './dashboard.service';

@Component({
  selector: 'app-admin',
  imports: [RouterLink],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminHome implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dashboardApi = inject(DashboardService);
  private readonly router = inject(Router);

  readonly user = signal<AuthUser | null>(null);
  readonly dashboard = signal<OpsDashboard | null>(null);
  readonly cards = signal<DashboardCard[]>([]);
  readonly loadError = signal('');
  readonly dashboardError = signal('');
  readonly pending = signal(true);
  readonly dashboardPending = signal(false);

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.pending.set(false);
        this.loadDashboard();
      },
      error: () => {
        this.pending.set(false);
        this.loadError.set('Could not load the admin session.');
        void this.router.navigateByUrl('/admin/login');
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/admin/login');
      },
      error: () => {
        void this.router.navigateByUrl('/admin/login');
      },
    });
  }

  private loadDashboard(): void {
    this.dashboardPending.set(true);
    this.dashboardError.set('');
    this.dashboardApi.get().subscribe({
      next: ({ dashboard }) => {
        this.dashboard.set(dashboard);
        this.cards.set(dashboardCards(dashboard));
        this.dashboardPending.set(false);
      },
      error: () => {
        this.dashboardPending.set(false);
        this.dashboardError.set('Could not load operational counts.');
      },
    });
  }
}
