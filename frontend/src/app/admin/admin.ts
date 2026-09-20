import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, type AuthUser } from '../auth/auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminHome implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = signal<AuthUser | null>(null);
  readonly loadError = signal('');
  readonly pending = signal(true);

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.pending.set(false);
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
}
