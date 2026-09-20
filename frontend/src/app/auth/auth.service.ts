import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role?: 'tourist' | 'admin';
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export function isAdminUser(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = `${environment.apiBaseUrl}/auth`;

  constructor(private readonly http: HttpClient) {}

  signup(body: { email: string; password: string; displayName: string }): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.base}/signup`, body, {
      withCredentials: true,
    });
  }

  login(body: { email: string; password: string }): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.base}/login`, body, {
      withCredentials: true,
    });
  }

  adminLogin(body: { email: string; password: string }): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.base}/admin/login`, body, {
      withCredentials: true,
    });
  }

  logout(): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${this.base}/logout`, {}, { withCredentials: true });
  }

  me(): Observable<{ user: AuthUser }> {
    return this.http.get<{ user: AuthUser }>(`${this.base}/me`, { withCredentials: true });
  }
}
