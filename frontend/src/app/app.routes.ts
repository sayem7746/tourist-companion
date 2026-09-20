import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './auth/login';
import { Signup } from './auth/signup';
import { authGuard } from './auth/auth.guard';
import { Preferences } from './profile/preferences';
import { TripOnboarding } from './trips/trip-onboarding';
import { TripDashboard } from './trips/trip-dashboard';
import { ArrivalChecklist } from './arrival/arrival-checklist';
import { ArrivalTransport } from './arrival/arrival-transport';
import { Explore } from './explore/explore';
import { Concierge } from './concierge/concierge';

export const routes: Routes = [
  { path: '', component: Home, title: 'Tourist Companion' },
  { path: 'login', component: Login, title: 'Sign in' },
  { path: 'signup', component: Signup, title: 'Create account' },
  { path: 'arrival/transport', component: ArrivalTransport, title: 'Airport transport' },
  { path: 'arrival', component: ArrivalChecklist, title: 'Arrival checklist' },
  { path: 'explore', component: Explore, title: 'Explore' },
  { path: 'concierge', component: Concierge, title: 'Concierge' },
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
