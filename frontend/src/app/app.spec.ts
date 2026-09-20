import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App, isAdminPath } from './app';
import { routes } from './app.routes';
import { adminGuard } from './admin/admin.guard';
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
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Malaysia Companion');
    expect(compiled.querySelector('.sos-btn')?.textContent).toContain('SOS');
    expect(compiled.querySelector('.sos-btn')?.getAttribute('href')).toBe('/emergency');
    expect(compiled.querySelector('.sos-btn')?.getAttribute('data-path')).toBe('emergency-help');
  });

  it('should expose public tourist login and signup routes', () => {
    const login = routes.find((route) => route.path === 'login');
    expect(login?.canActivate).toBeUndefined();
    expect(login?.title).toBe('Sign in');
    const signup = routes.find((route) => route.path === 'signup');
    expect(signup?.canActivate).toBeUndefined();
    expect(signup?.title).toBe('Create account');
  });

  it('should guard the trip dashboard', () => {
    const dashboard = routes.find((route) => route.path === 'trips');
    expect(dashboard?.canActivate).toEqual([authGuard]);
    expect(dashboard?.title).toBe('Plan');
  });

  it('should guard trip onboarding', () => {
    const onboarding = routes.find((route) => route.path === 'trips/new');
    expect(onboarding?.canActivate).toEqual([authGuard]);
    expect(onboarding?.title).toBe('Plan a trip');
  });

  it('should alias /plan to the Plan tab', () => {
    const plan = routes.find((route) => route.path === 'plan');
    expect(plan?.redirectTo).toBe('trips');
  });

  it('should guard preferences', () => {
    const settings = routes.find((route) => route.path === 'settings');
    expect(settings?.canActivate).toEqual([authGuard]);
  });

  it('should guard the admin home and expose /admin/login', () => {
    const admin = routes.find((route) => route.path === 'admin');
    expect(admin?.canActivate).toEqual([adminGuard]);
    expect(admin?.title).toBe('Operations');
    const login = routes.find((route) => route.path === 'admin/login');
    expect(login?.canActivate).toBeUndefined();
    expect(login?.title).toBe('Admin sign in');
    expect(isAdminPath('/admin')).toBeTrue();
    expect(isAdminPath('/admin/login')).toBeTrue();
    expect(isAdminPath('/admin/content')).toBeTrue();
    expect(isAdminPath('/admin/faqs')).toBeTrue();
    expect(isAdminPath('/admin/partners')).toBeTrue();
    expect(isAdminPath('/admin/audit')).toBeTrue();
    expect(isAdminPath('/')).toBeFalse();
  });

  it('should guard admin content CMS pages', () => {
    const list = routes.find((route) => route.path === 'admin/content');
    expect(list?.canActivate).toEqual([adminGuard]);
    expect(list?.title).toBe('Content');
    const create = routes.find((route) => route.path === 'admin/content/new');
    expect(create?.canActivate).toEqual([adminGuard]);
    const edit = routes.find((route) => route.path === 'admin/content/:id');
    expect(edit?.canActivate).toEqual([adminGuard]);
  });

  it('should guard dedicated FAQ admin pages', () => {
    const list = routes.find((route) => route.path === 'admin/faqs');
    expect(list?.canActivate).toEqual([adminGuard]);
    expect(list?.title).toBe('FAQs');
    const create = routes.find((route) => route.path === 'admin/faqs/new');
    expect(create?.canActivate).toEqual([adminGuard]);
    expect(create?.title).toBe('New FAQ');
    const edit = routes.find((route) => route.path === 'admin/faqs/:id');
    expect(edit?.canActivate).toEqual([adminGuard]);
    expect(edit?.title).toBe('Edit FAQ');
  });

  it('should guard the admin audit log', () => {
    const audit = routes.find((route) => route.path === 'admin/audit');
    expect(audit?.canActivate).toEqual([adminGuard]);
    expect(audit?.title).toBe('Audit log');
  });

  it('should guard partner listing admin pages', () => {
    const list = routes.find((route) => route.path === 'admin/partners');
    expect(list?.canActivate).toEqual([adminGuard]);
    expect(list?.title).toBe('Partners');
    const create = routes.find((route) => route.path === 'admin/partners/new');
    expect(create?.canActivate).toEqual([adminGuard]);
    expect(create?.title).toBe('New partner');
    const edit = routes.find((route) => route.path === 'admin/partners/:id');
    expect(edit?.canActivate).toEqual([adminGuard]);
    expect(edit?.title).toBe('Edit partner');
  });

  it('should expose a public arrival checklist route', () => {
    const arrival = routes.find((route) => route.path === 'arrival');
    expect(arrival?.component).toBeTruthy();
    expect(arrival?.canActivate).toBeUndefined();
  });

  it('should expose a public airport transport guide route', () => {
    const transport = routes.find((route) => route.path === 'arrival/transport');
    expect(transport?.component).toBeTruthy();
    expect(transport?.canActivate).toBeUndefined();
  });

  it('should expose a public SIM and connectivity guide route', () => {
    const sim = routes.find((route) => route.path === 'arrival/sim');
    expect(sim?.component).toBeTruthy();
    expect(sim?.canActivate).toBeUndefined();
  });

  it('should expose a public emergency help route', () => {
    const emergency = routes.find((route) => route.path === 'emergency');
    expect(emergency?.component).toBeTruthy();
    expect(emergency?.canActivate).toBeUndefined();
    expect(emergency?.title).toBe('Emergency help');
  });

  it('should expose a public embassy directory route', () => {
    const embassies = routes.find((route) => route.path === 'embassies');
    expect(embassies?.component).toBeTruthy();
    expect(embassies?.canActivate).toBeUndefined();
    expect(embassies?.title).toBe('Embassies and consulates');
  });

  it('should expose a public tourist safety guide route', () => {
    const safety = routes.find((route) => route.path === 'safety');
    expect(safety?.component).toBeTruthy();
    expect(safety?.canActivate).toBeUndefined();
    expect(safety?.title).toBe('Safety tips');
  });

  it('should expose a public Malaysia AI Concierge route', () => {
    const concierge = routes.find((route) => route.path === 'concierge');
    expect(concierge?.component).toBeTruthy();
    expect(concierge?.canActivate).toBeUndefined();
    expect(concierge?.title).toBe('Malaysia AI Concierge');
  });

  it('should expose a public Explore nearby route', () => {
    const explore = routes.find((route) => route.path === 'explore');
    expect(explore?.component).toBeTruthy();
    expect(explore?.canActivate).toBeUndefined();
    expect(explore?.title).toBe('Explore');
  });

  it('should expose a public place details route', () => {
    const details = routes.find((route) => route.path === 'explore/:id');
    expect(details?.component).toBeTruthy();
    expect(details?.canActivate).toBeUndefined();
    expect(details?.title).toBe('Place details');
  });

  it('should expose a public currency and payment guide route', () => {
    const money = routes.find((route) => route.path === 'arrival/money');
    expect(money?.component).toBeTruthy();
    expect(money?.canActivate).toBeUndefined();
  });

  it('should render Tropical Sanctuary bottom tabs', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = Array.from(compiled.querySelectorAll('.tab-bar .tab-label')).map((el) =>
      el.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toEqual(['Home', 'Explore', 'Plan', 'Concierge', 'Profile']);
  });
});
