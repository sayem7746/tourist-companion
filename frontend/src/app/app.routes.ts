import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './auth/login';
import { Signup } from './auth/signup';
import { authGuard } from './auth/auth.guard';
import { Preferences } from './profile/preferences';
import { TripOnboarding } from './trips/trip-onboarding';
import { TripDashboard } from './trips/trip-dashboard';

export const routes: Routes = [
  { path: '', component: Home, title: 'Tourist Companion' },
  { path: 'login', component: Login, title: 'Sign in' },
  { path: 'signup', component: Signup, title: 'Create account' },
  {
    path: 'trips',
    component: TripDashboard,
    canActivate: [authGuard],
    title: 'Trip dashboard',
  },
  {
    path: 'trips/new',
    component: TripOnboarding,
    canActivate: [authGuard],
    title: 'Plan a trip',
  },
  {
    path: 'settings',
    component: Preferences,
    canActivate: [authGuard],
    title: 'Preferences',
  },
  { path: '**', redirectTo: '' },
];
