import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './auth-forms.css',
})
export class Signup {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  displayName = '';
  email = '';
  password = '';
  readonly error = signal('');
  readonly pending = signal(false);

  submit(): void {
    this.error.set('');
    this.pending.set(true);
    this.auth
      .signup({
        displayName: this.displayName,
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.pending.set(false);
          void this.router.navigateByUrl('/');
        },
        error: () => {
          this.pending.set(false);
          this.error.set('Could not create that account. Try a different email.');
        },
      });
  }
}
