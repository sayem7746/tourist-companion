import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { authGuard } from './auth/auth.guard';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Tourist Companion');
  });

  it('should guard the trip dashboard', () => {
    const dashboard = routes.find((route) => route.path === 'trips');
    expect(dashboard?.canActivate).toEqual([authGuard]);
  });

  it('should guard preferences', () => {
    const settings = routes.find((route) => route.path === 'settings');
    expect(settings?.canActivate).toEqual([authGuard]);
  });

  it('should expose a public arrival checklist route', () => {
    const arrival = routes.find((route) => route.path === 'arrival');
    expect(arrival?.component).toBeTruthy();
    expect(arrival?.canActivate).toBeUndefined();
  });
});
