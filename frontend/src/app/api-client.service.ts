import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  readonly enabled = environment.apiUrl.length > 0;

  private http = inject(HttpClient);

  get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${environment.apiUrl}${path}`, { withCredentials: true }));
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const csrf = await this.csrfToken();
    return firstValueFrom(this.http.post<T>(`${environment.apiUrl}${path}`, body, {
      withCredentials: true,
      headers: new HttpHeaders({ 'X-CSRF-Token': csrf }),
    }));
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const csrf = await this.csrfToken();
    return firstValueFrom(this.http.patch<T>(`${environment.apiUrl}${path}`, body, {
      withCredentials: true,
      headers: new HttpHeaders({ 'X-CSRF-Token': csrf }),
    }));
  }

  async delete<T>(path: string): Promise<T> {
    const csrf = await this.csrfToken();
    return firstValueFrom(this.http.delete<T>(`${environment.apiUrl}${path}`, {
      withCredentials: true,
      headers: new HttpHeaders({ 'X-CSRF-Token': csrf }),
    }));
  }

  private async csrfToken(): Promise<string> {
    const response = await this.get<{ csrfToken: string }>('/auth/csrf');
    return response.csrfToken;
  }
}
