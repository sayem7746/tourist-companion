import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Login } from './auth/login';
import { Signup } from './auth/signup';

export const routes: Routes = [
  { path: '', component: Home, title: 'Tourist Companion' },
  { path: 'login', component: Login, title: 'Sign in' },
  { path: 'signup', component: Signup, title: 'Create account' },
  { path: '**', redirectTo: '' },
];
