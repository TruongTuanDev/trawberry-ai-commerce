import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order } from '../models/order.model';
import { PageResponse } from '../models/product-dto.model';

export interface PaymentDetail {
  orderId: string;
  orderNumber: string;
  orderCreatedAt: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  paymentStatus: string;
  transferAmount: number;
  transferTime: string;
  receiptImageUrl: string;
  submittedAt: string;
  reviewedAt?: string;
  orderTotal: number;
  payerName: string;
  reviewNote?: string;
}

@Injectable({ providedIn: 'root' })
export class SellerOrderApiService {
  private http = inject(HttpClient);
  private getBaseUrl(shopId: string) {
    return `${environment.apiUrl}/api/v1/seller/shops/${shopId}`;
  }

  getShopOrders(shopId: string, status?: string, paymentStatus?: string): Observable<Order[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (paymentStatus) params = params.set('paymentStatus', paymentStatus);

    return this.http.get<Order[]>(`${this.getBaseUrl(shopId)}/orders`, { params });
  }

  getShopPayments(
    shopId: string,
    page = 0,
    size = 20,
    search?: string,
    status?: string,
    fromDate?: string,
    toDate?: string,
  ): Observable<PageResponse<PaymentDetail>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);

    return this.http.get<PageResponse<PaymentDetail>>(`${this.getBaseUrl(shopId)}/payments`, { params });
  }

  getOrderDetails(shopId: string, orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.getBaseUrl(shopId)}/orders/${orderId}`);
  }

  approvePayment(shopId: string, orderId: string): Observable<Order> {
    return this.http.post<Order>(`${this.getBaseUrl(shopId)}/orders/${orderId}/payment/approve`, {});
  }

  rejectPayment(shopId: string, orderId: string, reason?: string): Observable<Order> {
    return this.http.post<Order>(
      `${this.getBaseUrl(shopId)}/orders/${orderId}/payment/reject`,
      reason ? { reason } : {}
    );
  }

  updateFulfillmentStatus(shopId: string, orderId: string, status: string): Observable<Order> {
    const params = new HttpParams().set('status', status);
    return this.http.put<Order>(`${this.getBaseUrl(shopId)}/orders/${orderId}/status`, null, { params });
  }
}
