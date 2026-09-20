import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService, isAdminUser } from '../auth/auth.service';

export function safeAdminReturnUrl(value: string | null): string {
  if (value && value.startsWith('/admin') && !value.startsWith('//')) {
    return value;
  }
  return '/admin';
}

export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((body) =>
      isAdminUser(body.user)
        ? true
        : router.createUrlTree(['/admin/login'], {
            queryParams: { returnUrl: state.url },
          }),
    ),
    catchError(() =>
      of(
        router.createUrlTree(['/admin/login'], {
          queryParams: { returnUrl: state.url },
        }),
      ),
    ),
  );
};
