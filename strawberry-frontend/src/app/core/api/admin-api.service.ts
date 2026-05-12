import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PendingSellerDto {
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  sellerProfileId: string;
  approvalStatus: string;
  createdAt: string;
}

export interface ApprovalResponseDto {
  userId: string;
  approvalStatus: string;
  reviewedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/admin/sellers`;

  getPendingSellers(): Observable<PendingSellerDto[]> {
    return this.http.get<PendingSellerDto[]>(`${this.base}/pending`);
  }

  approveSeller(sellerProfileId: string): Observable<ApprovalResponseDto> {
    return this.http.post<ApprovalResponseDto>(`${this.base}/${sellerProfileId}/approve`, {});
  }

  rejectSeller(sellerProfileId: string, reason?: string): Observable<ApprovalResponseDto> {
    return this.http.post<ApprovalResponseDto>(`${this.base}/${sellerProfileId}/reject`, reason ? { reason } : {});
  }
}
