import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PageResponse,
  ProductResponseDto,
  ProductDetailResponseDto,
  ProductMetadataRequestDto,
  VariantPricingRequestDto,
  VariantInventoryRequestDto,
  ProductPricingResponseDto,
  VariantPricingBulkUpdateRequestDto,
  VariantInventoryResponseDto,
  VariantInventoryBulkUpdateRequestDto
} from '../models/product-dto.model';

@Injectable({ providedIn: 'root' })
export class SellerProductApiService {
  private http = inject(HttpClient);
  private getBaseUrl(shopId: string) {
    return `${environment.apiUrl}/api/v1/seller/shops/${shopId}/products`;
  }

  getProducts(
    shopId: string,
    page: number,
    size: number,
    search?: string,
    wbId?: number,
    categoryIds?: number[],
    visibility?: string,
    inStock?: boolean
  ): Observable<PageResponse<ProductResponseDto>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    if (wbId) params = params.set('wbId', wbId.toString());
    
    if (categoryIds && categoryIds.length > 0) {
      categoryIds.forEach(id => {
        params = params.append('categoryIds', id.toString());
      });
    }

    if (visibility) params = params.set('visibility', visibility);
    if (inStock !== undefined && inStock !== null) params = params.set('inStock', inStock);

    return this.http.get<PageResponse<ProductResponseDto>>(this.getBaseUrl(shopId), { params });
  }

  getShopCategories(shopId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.getBaseUrl(shopId)}/categories`);
  }

  getProductDetail(shopId: string, productId: string): Observable<ProductDetailResponseDto> {
    return this.http.get<ProductDetailResponseDto>(`${this.getBaseUrl(shopId)}/${productId}`);
  }

  updateMetadata(shopId: string, productId: string, request: ProductMetadataRequestDto): Observable<void> {
    return this.http.put<void>(`${this.getBaseUrl(shopId)}/${productId}/metadata`, request);
  }

  updatePricing(shopId: string, variantId: string, request: VariantPricingRequestDto): Observable<void> {
    return this.http.put<void>(`${this.getBaseUrl(shopId)}/variants/${variantId}/pricing`, request);
  }

  updateInventory(shopId: string, variantId: string, request: VariantInventoryRequestDto): Observable<void> {
    return this.http.put<void>(`${this.getBaseUrl(shopId)}/variants/${variantId}/inventory`, request);
  }

  getPricingProducts(
    shopId: string,
    page: number,
    size: number,
    search?: string,
    categoryIds?: number[],
    visibility?: string,
    inStock?: boolean
  ): Observable<PageResponse<ProductPricingResponseDto>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    if (categoryIds && categoryIds.length > 0) {
      categoryIds.forEach(id => {
        params = params.append('categoryIds', id.toString());
      });
    }
    if (visibility) params = params.set('visibility', visibility);
    if (inStock !== undefined && inStock !== null) params = params.set('inStock', inStock);

    return this.http.get<PageResponse<ProductPricingResponseDto>>(`${this.getBaseUrl(shopId)}/pricing`, { params });
  }

  bulkUpdateVariantPricing(shopId: string, updates: VariantPricingBulkUpdateRequestDto): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/v1/seller/shops/${shopId}/variants/bulk-pricing`, updates);
  }

  getInventoryVariants(
    shopId: string,
    page: number,
    size: number,
    search?: string,
    categoryIds?: number[],
    inStock?: boolean
  ): Observable<PageResponse<VariantInventoryResponseDto>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    if (categoryIds && categoryIds.length > 0) {
      categoryIds.forEach(id => {
        params = params.append('categoryIds', id.toString());
      });
    }
    if (inStock !== undefined && inStock !== null) params = params.set('inStock', inStock);

    return this.http.get<PageResponse<VariantInventoryResponseDto>>(
      `${environment.apiUrl}/api/v1/seller/shops/${shopId}/variants/inventory`,
      { params }
    );
  }

  bulkUpdateVariantInventory(shopId: string, updates: VariantInventoryBulkUpdateRequestDto): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/api/v1/seller/shops/${shopId}/variants/bulk-inventory`,
      updates
    );
  }
}
