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
import { ArrivalConnectivity } from './arrival/arrival-connectivity';
import { ArrivalCurrency } from './arrival/arrival-currency';
import { Explore } from './explore/explore';
import { PlaceDetailsPage } from './explore/place-details';
import { Concierge } from './concierge/concierge';
import { Emergency } from './emergency/emergency';
import { Embassies } from './embassies/embassies';
import { Safety } from './safety/safety';

export const routes: Routes = [
  { path: '', component: Home, title: 'Malaysia Companion' },
  { path: 'login', component: Login, title: 'Sign in' },
  { path: 'signup', component: Signup, title: 'Create account' },
  { path: 'arrival/transport', component: ArrivalTransport, title: 'Airport transport' },
  { path: 'arrival/sim', component: ArrivalConnectivity, title: 'SIM and connectivity' },
  { path: 'arrival/money', component: ArrivalCurrency, title: 'Currency and payments' },
  { path: 'arrival', component: ArrivalChecklist, title: 'Arrival checklist' },
  { path: 'explore', component: Explore, title: 'Explore' },
  { path: 'explore/:id', component: PlaceDetailsPage, title: 'Place details' },
  { path: 'concierge', component: Concierge, title: 'Malaysia AI Concierge' },
  { path: 'emergency', component: Emergency, title: 'Emergency help' },
  { path: 'embassies', component: Embassies, title: 'Embassies and consulates' },
  { path: 'safety', component: Safety, title: 'Safety tips' },
  {
    path: 'trips',
    component: TripDashboard,
    canActivate: [authGuard],
    title: 'Plan',
  },
  {
    path: 'plan',
    redirectTo: 'trips',
    pathMatch: 'full',
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
