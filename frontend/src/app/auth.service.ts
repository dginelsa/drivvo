import { inject, Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';

const SESSION_KEY = 'drivvo.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiClient);

  get isAuthenticated(): boolean {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === 'active';
  }

  get apiEnabled(): boolean { return this.api.enabled; }

  async checkSession(): Promise<boolean> {
    if (!this.api.enabled) return this.isAuthenticated;
    try {
      await this.api.get('/auth/me');
      sessionStorage.setItem(SESSION_KEY, 'active');
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await this.api.post('/auth/login', { email, password });
    sessionStorage.setItem(SESSION_KEY, 'active');
  }

  async register(email: string, password: string): Promise<void> {
    await this.api.post('/auth/register', { email, password });
    sessionStorage.setItem(SESSION_KEY, 'active');
  }

  async logout(): Promise<void> {
    if (this.api.enabled) await this.api.post('/auth/logout', {});
    this.clearSession();
  }

  enterDemo(): void {
    sessionStorage.setItem(SESSION_KEY, 'active');
  }

  clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
