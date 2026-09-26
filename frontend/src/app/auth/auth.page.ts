import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: false,
})
export class AuthPage {
  readonly year = new Date().getFullYear();
  mode: 'login' | 'register' = 'login';
  email = '';
  password = '';
  error = '';
  busy = false;

  get apiEnabled(): boolean { return this.auth.apiEnabled; }

  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    if (this.auth.isAuthenticated || (this.auth.apiEnabled && !this.auth.canPersistSession)) void this.auth.checkSession().then((authenticated) => {
      if (authenticated) void this.router.navigateByUrl('/home');
    });
  }

  async submit(): Promise<void> {
    this.error = '';
    if (!this.email.trim() || this.password.length < 12) {
      this.error = 'Enter an email and a password with at least 12 characters.';
      return;
    }
    this.busy = true;
    try {
      if (this.mode === 'register') await this.auth.register(this.email, this.password);
      else await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/home');
    } catch (error) {
      this.error = error instanceof HttpErrorResponse
        ? error.error?.error?.message ?? 'Could not reach the account service. Try again.'
        : 'Could not complete sign in. Try again.';
    } finally {
      this.busy = false;
    }
  }

  enterDemo(): void {
    this.auth.enterDemo();
    void this.router.navigateByUrl('/home');
  }
}
