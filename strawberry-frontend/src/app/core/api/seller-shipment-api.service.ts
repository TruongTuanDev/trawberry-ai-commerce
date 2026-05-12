import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShipmentResponseDto, CreateShipmentRequestDto, ShipmentStatus, DeliveryIssueResponseDto, DeliveryIssueStatus } from '../models/shipping.model';

@Injectable({ providedIn: 'root' })
export class SellerShipmentApiService {
  private http = inject(HttpClient);
  private getBaseUrl(shopId: string) {
    return `${environment.apiUrl}/api/v1/seller/shops/${shopId}`;
  }

  createShipment(shopId: string, orderId: string, request: CreateShipmentRequestDto): Observable<ShipmentResponseDto> {
    return this.http.post<ShipmentResponseDto>(`${this.getBaseUrl(shopId)}/orders/${orderId}/ship`, request);
  }

  updateShipmentStatus(shopId: string, shipmentId: string, newStatus: ShipmentStatus): Observable<ShipmentResponseDto> {
    const params = new HttpParams().set('newStatus', newStatus);
    return this.http.put<ShipmentResponseDto>(`${this.getBaseUrl(shopId)}/shipments/${shipmentId}/status`, null, { params });
  }

  getShopShipments(shopId: string): Observable<ShipmentResponseDto[]> {
    return this.http.get<ShipmentResponseDto[]>(`${this.getBaseUrl(shopId)}/shipments`);
  }

  getDeliveryIssues(shopId: string): Observable<DeliveryIssueResponseDto[]> {
    return this.http.get<DeliveryIssueResponseDto[]>(`${this.getBaseUrl(shopId)}/delivery-issues`);
  }

  updateDeliveryIssueStatus(shopId: string, issueId: string, status: DeliveryIssueStatus): Observable<DeliveryIssueResponseDto> {
    return this.http.put<DeliveryIssueResponseDto>(`${this.getBaseUrl(shopId)}/delivery-issues/${issueId}/status`, { status });
  }
}
