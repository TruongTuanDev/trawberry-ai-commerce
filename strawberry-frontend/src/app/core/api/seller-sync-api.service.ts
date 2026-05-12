import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SyncHealthDto, SyncHistoryDto } from '../models/shipping.model';

@Injectable({ providedIn: 'root' })
export class SellerSyncApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/v1/seller/shops`;

  private shopUrl(shopId: string) {
    return `${this.baseUrl}/${shopId}/sync`;
  }

  getSyncHealth(shopId: string): Observable<SyncHealthDto> {
    return this.http.get<SyncHealthDto>(`${this.shopUrl(shopId)}/stats`);
  }

  getSyncHistory(shopId: string, limit = 15): Observable<SyncHistoryDto[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<SyncHistoryDto[]>(`${this.shopUrl(shopId)}/history`, { params });
  }

  triggerFullSync(shopId: string): Observable<any> {
    return this.http.post(`${this.shopUrl(shopId)}/full`, {});
  }

  triggerIncrementalSync(shopId: string): Observable<any> {
    return this.http.post(`${this.shopUrl(shopId)}/update`, { syncType: 'INCREMENTAL' });
  }

  updateSyncSettings(shopId: string, syncIntervalMinutes: number, isSyncPaused: boolean): Observable<void> {
    return this.http.put<void>(`${this.shopUrl(shopId)}/settings`, { syncIntervalMinutes, isSyncPaused });
  }
}
