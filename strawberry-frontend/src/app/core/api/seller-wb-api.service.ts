import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IntegrationResponseDto {
  integrationId: string;
  shopId: string;
  isActive: boolean;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class SellerWbApiService {
  private http = inject(HttpClient);
  private getBaseUrl(shopId: string) {
    return `${environment.apiUrl}/api/v1/seller/shops/${shopId}`;
  }

  getIntegration(shopId: string): Observable<IntegrationResponseDto> {
    return this.http.get<IntegrationResponseDto>(`${this.getBaseUrl(shopId)}/integration`);
  }

  updateApiKey(shopId: string, wbApiKey: string): Observable<IntegrationResponseDto> {
    return this.http.put<IntegrationResponseDto>(`${this.getBaseUrl(shopId)}/api-key`, { wbApiKey });
  }
}
