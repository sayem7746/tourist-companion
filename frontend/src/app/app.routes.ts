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
import { AdminHome } from './admin/admin';
import { AdminLogin } from './admin/admin-login';
import { AdminContent } from './admin/admin-content';
import { AdminContentEditor } from './admin/admin-content-editor';
import { AdminFaqs } from './admin/admin-faqs';
import { AdminFaqEditor } from './admin/admin-faq-editor';
import { adminGuard } from './admin/admin.guard';

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
  { path: 'admin/login', component: AdminLogin, title: 'Admin sign in' },
  {
    path: 'admin',
    component: AdminHome,
    canActivate: [adminGuard],
    title: 'Operations',
  },
  {
    path: 'admin/content',
    component: AdminContent,
    canActivate: [adminGuard],
    title: 'Content',
  },
  {
    path: 'admin/content/new',
    component: AdminContentEditor,
    canActivate: [adminGuard],
    title: 'New content',
  },
  {
    path: 'admin/content/:id',
    component: AdminContentEditor,
    canActivate: [adminGuard],
    title: 'Edit content',
  },
  {
    path: 'admin/faqs',
    component: AdminFaqs,
    canActivate: [adminGuard],
    title: 'FAQs',
  },
  {
    path: 'admin/faqs/new',
    component: AdminFaqEditor,
    canActivate: [adminGuard],
    title: 'New FAQ',
  },
  {
    path: 'admin/faqs/:id',
    component: AdminFaqEditor,
    canActivate: [adminGuard],
    title: 'Edit FAQ',
  },
  { path: '**', redirectTo: '' },
];
