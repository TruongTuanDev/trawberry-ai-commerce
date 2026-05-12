import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ShippingMethod, ShippingZone } from '../models/shipping.model';

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/public/shipping`;

  getZones() {
    return this.http.get<ShippingZone[]>(`${this.base}/zones`);
  }

  getMethods(zoneId?: string) {
    let params = new HttpParams();
    if (zoneId) params = params.set('zoneId', zoneId);
    return this.http.get<ShippingMethod[]>(`${this.base}/methods`, { params });
  }
}
