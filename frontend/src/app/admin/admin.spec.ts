import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminHome } from './admin';

const adminUser = {
  id: '1',
  email: 'ops@example.com',
  displayName: 'Ops',
  role: 'admin' as const,
};

describe('AdminHome', () => {
  let fixture: ComponentFixture<AdminHome>;
  let component: AdminHome;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminHome);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should show the signed-in administrator', () => {
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({ user: adminUser });
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Operations');
    expect(compiled.textContent).toContain('ops@example.com');
    expect(compiled.textContent).toContain('admin');
    expect(compiled.textContent).toContain('Manage content');
    expect(compiled.textContent).toContain('Manage FAQs');
    expect(compiled.querySelector('a[href="/admin/content"]')).toBeTruthy();
    expect(compiled.querySelector('a[href="/admin/faqs"]')).toBeTruthy();
  });

  it('should sign out and return to admin login', () => {
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush({ user: adminUser });
    component.logout();
    const req = http.expectOne(`${environment.apiBaseUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/login');
  });
});
