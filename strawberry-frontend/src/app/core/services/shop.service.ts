import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Shop {
  id: string;
  slug: string;
  name: string;
  logo?: string;
  description?: string;
  contactInfo?: string;
  bankName?: string;
  accountNumber?: string;
  bankBranch?: string;
  accountHolderName?: string;
  bik?: string;
  correspondentAccount?: string;
  paymentInstructions?: string;
  productCount?: number;
  orderCount?: number;
  newOrderCount?: number;
  deliveredOrderCount?: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'DRAFT';
  createdAt?: string;
}

export interface SellerWorkspace {
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  hasShops: boolean;
  shopCount: number;
  currentShop?: Shop | null;
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1/seller/shops`;
  private readonly workspaceUrl = `${environment.apiUrl}/api/v1/seller/workspace`;

  getSellerShops(): Observable<Shop[]> {
    return this.http.get<Shop[]>(this.baseUrl);
  }

  getShopDetail(shopId: string): Observable<Shop> {
    return this.http.get<Shop>(`${this.baseUrl}/${shopId}`);
  }

  createShop(data: Partial<Shop>): Observable<Shop> {
    return this.http.post<Shop>(this.baseUrl, data);
  }

  updateShop(shopId: string, data: Partial<Shop>): Observable<Shop> {
    return this.http.put<Shop>(`${this.baseUrl}/${shopId}`, data);
  }

  getSellerWorkspace(): Observable<SellerWorkspace> {
    return this.http.get<SellerWorkspace>(this.workspaceUrl);
  }

  activateShop(shopId: string): Observable<SellerWorkspace> {
    return this.http.post<SellerWorkspace>(`${this.workspaceUrl}/shops/${shopId}/activate`, {});
  }
}
