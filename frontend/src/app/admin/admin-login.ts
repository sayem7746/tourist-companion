import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, isAdminUser } from '../auth/auth.service';
import { safeAdminReturnUrl } from './admin.guard';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule],
  templateUrl: './admin-login.html',
  styleUrl: '../auth/auth-forms.css',
})
export class AdminLogin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly error = signal('');
  readonly pending = signal(false);

  submit(): void {
    this.error.set('');
    this.pending.set(true);
    this.auth.adminLogin({ email: this.email, password: this.password }).subscribe({
      next: ({ user }) => {
        this.pending.set(false);
        if (!isAdminUser(user)) {
          this.error.set('This account is not an administrator.');
          return;
        }
        void this.router.navigateByUrl(
          safeAdminReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        );
      },
      error: (err: unknown) => {
        this.pending.set(false);
        this.error.set(adminLoginError(err));
      },
    });
  }
}

export function adminLoginError(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 403) {
    return 'This account is not an administrator.';
  }
  return 'Invalid email or password.';
}
