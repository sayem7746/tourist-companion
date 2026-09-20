import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './auth-forms.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly error = signal('');
  readonly pending = signal(false);

  submit(): void {
    this.error.set('');
    this.pending.set(true);
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.pending.set(false);
        void this.router.navigateByUrl('/');
      },
      error: () => {
        this.pending.set(false);
        this.error.set('Invalid email or password.');
      },
    });
  }
}
