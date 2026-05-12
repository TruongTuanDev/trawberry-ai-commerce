import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CheckoutRequest,
  Order,
  PaymentConfirmationUploadRequest,
  ReviewCreateRequest,
  Tracking,
} from '../models/order.model';
import { ReviewResponseDto } from '../models/product-dto.model';
import { DeliveryIssue } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/customer`;

  checkout(req: CheckoutRequest) {
    return this.http.post<Order[]>(`${this.base}/orders/checkout`, req);
  }

  getOrders() {
    return this.http.get<Order[]>(`${this.base}/orders`);
  }

  getOrder(id: string) {
    return this.http.get<Order>(`${this.base}/orders/${id}`);
  }

  uploadPaymentConfirmation(orderId: string, payload: PaymentConfirmationUploadRequest) {
    const form = new FormData();
    form.append('receiptImage', payload.receiptImage);
    form.append('payerName', payload.payerName);
    form.append('transferAmount', String(payload.transferAmount));
    form.append('transferTime', payload.transferTime);
    return this.http.post<Order>(`${this.base}/orders/${orderId}/payment-confirmation`, form);
  }

  getTracking(orderId: string) {
    return this.http.get<Tracking>(`${this.base}/orders/${orderId}/tracking`);
  }

  completeOrder(orderId: string) {
    return this.http.post<Order>(`${this.base}/orders/${orderId}/complete`, {});
  }

  reportNotReceived(orderId: string, note?: string) {
    return this.http.post<DeliveryIssue>(`${this.base}/orders/${orderId}/delivery-issues`, note ? { note } : {});
  }

  submitReview(orderId: string, orderItemId: string, payload: ReviewCreateRequest) {
    return this.http.post<ReviewResponseDto>(`${this.base}/orders/${orderId}/items/${orderItemId}/review`, payload);
  }
}
