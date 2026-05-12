import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CategoryResponseDto, FilterSuggestions, PageResponse, ProductDetailResponseDto, ProductResponseDto, ReviewResponseDto } from '../models/product-dto.model';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/public/catalog`;

  getProducts(params: {
    search?: string;
    categoryId?: number;
    shopSlug?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort?: string;
    page?: number;
    size?: number;
  }): Observable<PageResponse<ProductResponseDto>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<PageResponse<ProductResponseDto>>(`${this.base}/products`, { params: httpParams });
  }

  getProductBySlug(slug: string): Observable<ProductDetailResponseDto> {
    return this.http.get<ProductDetailResponseDto>(`${this.base}/products/${slug}`);
  }

  getFilters(): Observable<FilterSuggestions> {
    return this.http.get<FilterSuggestions>(`${this.base}/filters`);
  }

  getCategories(): Observable<CategoryResponseDto[]> {
    return this.http.get<CategoryResponseDto[]>(`${this.base}/categories`);
  }

  getReviews(slug: string, page = 0, size = 10): Observable<PageResponse<ReviewResponseDto>> {
    return this.http.get<PageResponse<ReviewResponseDto>>(`${this.base}/products/${slug}/reviews`, {
      params: { page, size }
    });
  }

  getRecommendations(slug: string, limit = 4): Observable<ProductResponseDto[]> {
    return this.http.get<ProductResponseDto[]>(`${this.base}/products/${slug}/recommendations`, {
      params: { limit }
    });
  }
}
