import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  CurrentUser,
  LoginRequest,
  RegisterRequest,
  coerceRole,
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  private readonly TOKEN_KEY = 'sb_token';
  private readonly USER_KEY = 'sb_user';

  currentUser = signal<CurrentUser | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  getCurrentUser(): CurrentUser | null {
    if (this.currentUser()) return this.currentUser();

    if (!isPlatformBrowser(this.platformId)) return null;

    const raw = localStorage.getItem(this.USER_KEY);
    const token = localStorage.getItem(this.TOKEN_KEY);

    if (!raw || !token) return null;

    try {
      const parsed = JSON.parse(raw);
      const user: CurrentUser = {
        email: parsed.email,
        fullName: parsed.fullName,
        role: coerceRole(parsed.role),
        token,
      };
      this.currentUser.set(user);
      return user;
    } catch {
      this.clearStorage();
      return null;
    }
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const raw = localStorage.getItem(this.USER_KEY);
    if (raw) {
      try {
        this.currentUser.set(JSON.parse(raw));
      } catch {
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  private saveToStorage(res: AuthResponse): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const user: CurrentUser = {
      email: res.email,
      fullName: res.fullName,
      role: coerceRole(res.role),
      token: res.accessToken,
    };
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  login(body: LoginRequest) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/v1/auth/login`, body)
      .pipe(tap((res) => this.saveToStorage(res)));
  }

  register(body: RegisterRequest) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/v1/auth/register/customer`, body)
      .pipe(tap((res) => this.saveToStorage(res)));
  }

  registerSeller(body: RegisterRequest) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/v1/auth/register/seller`, body)
      .pipe(tap((res) => this.saveToStorage(res)));
  }

  logout(): void {
    this.clearStorage();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
