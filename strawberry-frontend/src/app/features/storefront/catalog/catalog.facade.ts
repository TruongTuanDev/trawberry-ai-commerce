import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CatalogApiService } from '../../../core/api/catalog-api.service';
import { ProductCardVm, ProductDetailVm } from '../../../core/models/product-vm.model';
import {
  CategoryResponseDto,
  PageResponse,
  ProductDetailResponseDto,
  ProductResponseDto,
  ReviewResponseDto,
} from '../../../core/models/product-dto.model';

@Injectable({ providedIn: 'root' })
export class CatalogFacade {
  private api = inject(CatalogApiService);

  private _products = signal<ProductCardVm[]>([]);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);
  private _totalElements = signal<number>(0);
  private _totalPages = signal<number>(0);
  private _categories = signal<CategoryResponseDto[]>([]);
  private _productDetail = signal<ProductDetailVm | null>(null);
  private _reviews = signal<ReviewResponseDto[]>([]);
  private _recommendations = signal<ProductCardVm[]>([]);

  products = this._products.asReadonly();
  loading = this._loading.asReadonly();
  error = this._error.asReadonly();
  totalElements = this._totalElements.asReadonly();
  totalPages = this._totalPages.asReadonly();
  categories = this._categories.asReadonly();
  productDetail = this._productDetail.asReadonly();
  reviews = this._reviews.asReadonly();
  recommendations = this._recommendations.asReadonly();

  mapDtoToCardVm(dto: ProductResponseDto): ProductCardVm {
    return {
      id: dto.id,
      slug: dto.slug,
      title: dto.title,
      brand: dto.brand || '',
      originalPrice: dto.basePrice ?? dto.minPrice,
      finalPrice: dto.discountPrice ?? dto.minPrice,
      hasDiscount: !!dto.discountPrice && (dto.basePrice ?? dto.minPrice) > dto.discountPrice,
      thumbnailUrl: dto.mainImage ?? '/assets/placeholder.jpg',
      productUrl: `/products/${dto.slug}`,
      shopName: dto.shopName || '',
      inStock: dto.inStock,
      averageRating: dto.averageRate || 0,
      reviewCount: dto.reviewCount || 0,
      defaultVariantId: dto.defaultVariantId,
    };
  }

  loadProducts(params: {
    categoryId?: number;
    page?: number;
    size?: number;
    search?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    reset?: boolean;
  }): void {
    if (this._loading()) return;

    this._loading.set(true);
    this._error.set(null);

    this.api
      .getProducts({
        page: params.page ?? 0,
        size: params.size ?? 20,
        search: params.search?.trim() || undefined,
        categoryId: params.categoryId,
        brand: params.brand?.trim() || undefined,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        inStock: params.inStock,
      })
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (res: PageResponse<ProductResponseDto>) => {
          const mapped = res.content.map((dto) => this.mapDtoToCardVm(dto));

          if (params.reset) {
            this._products.set(mapped);
          } else {
            const deduped = new Map(this._products().map(product => [product.id, product]));
            for (const product of mapped) deduped.set(product.id, product);
            this._products.set(Array.from(deduped.values()));
          }

          this._totalElements.set(res.totalElements);
          this._totalPages.set(res.totalPages);
        },
        error: (err: any) => {
          this._error.set(err?.message || 'Failed to load catalog');
        },
      });
  }

  loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (categories) => this._categories.set(categories),
      error: () => this._categories.set([]),
    });
  }

  loadProductDetail(slug: string): void {
    this._loading.set(true);
    this._error.set(null);
    this._productDetail.set(null);

    this.api
      .getProductBySlug(slug)
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: (dto: ProductDetailResponseDto) => {
          const vm: ProductDetailVm = {
            id: dto.id,
            slug: dto.slug,
            title: dto.title,
            description: dto.description || '',
            brand: dto.brand || '',
            wbNmId: dto.wbNmId,
            categoryName: dto.category?.name || '',
            shopName: dto.shop?.name || '',
            shopSlug: dto.shop?.slug || '',
            images: dto.images || [],
            characteristics: dto.characteristics || [],
            reviewCount: dto.reviewCount || 0,
            averageRate: dto.averageRate || 0,
            variants: (dto.variants || []).map((v) => ({
              id: v.id,
              size: v.techSize,
              standardSize: v.techSize,
              russianSize: v.wbSize,
              price: v.discountPrice ?? v.basePrice,
              originalPrice: v.basePrice,
              hasDiscount: !!v.discountPrice && v.discountPrice < v.basePrice,
              inStock: v.inStock,
            })),
          };

          this._productDetail.set(vm);
        },
        error: (err: any) => {
          this._error.set(err?.message || 'Failed to load product details');
        },
      });
  }

  loadReviews(slug: string): void {
    this.api.getReviews(slug).subscribe({
      next: (res) => this._reviews.set(res.content),
      error: (err) => {
        this._reviews.set([]);
        console.error('Failed to load reviews', err);
      },
    });
  }

  loadRecommendations(slug: string): void {
    this.api.getRecommendations(slug).subscribe({
      next: (res) => {
        const mapped = res.map((dto) => this.mapDtoToCardVm(dto));
        this._recommendations.set(mapped);
      },
      error: (err) => {
        this._recommendations.set([]);
        console.error('Failed to load recommendations', err);
      },
    });
  }

  clearProductDetail(): void {
    this._productDetail.set(null);
    this._reviews.set([]);
    this._recommendations.set([]);
  }
}
