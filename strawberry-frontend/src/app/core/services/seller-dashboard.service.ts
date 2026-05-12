import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order } from '../models/order.model';

export interface SellerDashboardStats {
  productCount: number;
  orderCount: number;
  pendingPaymentCount: number;
  shipmentCount: number;
  lastSyncStatus: string | null;
  lastSuccessfulSyncAt: string | null;
  syncIntervalMinutes: number;
  isSyncPaused: boolean;
}

@Injectable({ providedIn: 'root' })
export class SellerDashboardService {
  private http = inject(HttpClient);

  getDashboardStats(shopId: string): Observable<SellerDashboardStats> {
    return this.http.get<SellerDashboardStats>(
      `${environment.apiUrl}/api/v1/seller/shops/${shopId}/dashboard`
    );
  }
}
