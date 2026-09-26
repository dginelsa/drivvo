import { inject, Injectable } from '@angular/core';
import { ApiClient } from './api-client.service';

const SESSION_KEY = 'drivvo.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiClient);
  private readonly storage = this.resolveStorage();

  get isAuthenticated(): boolean {
    return this.storage?.getItem(SESSION_KEY) === 'active';
  }

  get canPersistSession(): boolean { return this.storage !== null; }

  get apiEnabled(): boolean { return this.api.enabled; }

  async checkSession(): Promise<boolean> {
    if (!this.api.enabled) return this.isAuthenticated;
    try {
      await this.api.get('/auth/me');
      this.storage?.setItem(SESSION_KEY, 'active');
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await this.api.post('/auth/login', { email, password });
    this.storage?.setItem(SESSION_KEY, 'active');
  }

  async register(email: string, password: string): Promise<void> {
    await this.api.post('/auth/register', { email, password });
    this.storage?.setItem(SESSION_KEY, 'active');
  }

  async logout(): Promise<void> {
    if (this.api.enabled) await this.api.post('/auth/logout', {});
    this.clearSession();
  }

  enterDemo(): void {
    this.storage?.setItem(SESSION_KEY, 'active');
  }

  clearSession(): void {
    this.storage?.removeItem(SESSION_KEY);
  }

  private resolveStorage(): Storage | null {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    return null;
  }
}
