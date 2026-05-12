import { Injectable, inject, signal, computed } from '@angular/core';
import { SellerProductApiService } from '../../../core/api/seller-product-api.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { ProductPricingResponseDto, VariantPriceUpdate, PageResponse } from '../../../core/models/product-dto.model';
import { finalize, tap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of, Observable } from 'rxjs';

export interface PricingDirtyState {
  basePrice: number;
  discountPrice: number;
  originalBasePrice: number;
  originalDiscountPrice: number;
  discountPercent: number; // For UI calculation
}

@Injectable({ providedIn: 'root' })
export class SellerPricingFacade {
  private api = inject(SellerProductApiService);
  private shopContext = inject(ShopContextService);

  // State
  products = signal<ProductPricingResponseDto[]>([]);
  loading = signal(false);
  loadingMore = signal(false);
  isSaving = signal(false);
  
  // Pagination
  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  pageSize = signal(20);
  hasMore = computed(() => this.currentPage() < this.totalPages() - 1);

  // Filters
  search = signal('');
  categoryIds = signal<number[]>([]);
  visibility = signal<string | undefined>(undefined);
  inStock = signal<boolean | undefined>(undefined);

  // Metadata
  categoriesList = signal<any[]>([]);

  // Dirty State Tracking (Map variantId -> PricingDirtyState)
  dirtyVariants = signal<Map<string, PricingDirtyState>>(new Map());

  // Computed
  hasChanges = computed(() => this.dirtyVariants().size > 0);
  changedCount = computed(() => this.dirtyVariants().size);

  constructor() {
    // Reload when shop or filters change
    toObservable(this.shopContext.currentShopId).pipe(
      switchMap(shopId => {
        if (!shopId) return of(null);
        this.resetState();
        this.loadCategories(shopId);
        return this.loadProducts(0, false);
      })
    ).subscribe();
  }

  loadCategories(shopId: string) {
    this.api.getShopCategories(shopId).subscribe(list => {
      this.categoriesList.set(list);
    });
  }

  loadProducts(page = 0, append = false): Observable<any> {
    const shopId = this.shopContext.currentShopId();
    if (!shopId) return of(null);

    if (append) this.loadingMore.set(true);
    else this.loading.set(true);

    return this.api.getPricingProducts(
      shopId,
      page,
      this.pageSize(),
      this.search(),
      this.categoryIds(),
      this.visibility(),
      this.inStock()
    ).pipe(
      tap(res => {
        if (append) {
          this.products.update(prev => [...prev, ...res.content]);
        } else {
          this.products.set(res.content);
        }
        this.currentPage.set(res.number);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
      }),
      finalize(() => {
        this.loading.set(false);
        this.loadingMore.set(false);
      })
    );
  }

  loadNextPage() {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.loadProducts(this.currentPage() + 1, true).subscribe();
  }

  setFilters(search: string, categoryIds: number[]) {
    if (this.hasChanges() && !confirm('You have unsaved pricing changes. Discard them?')) {
      return;
    }
    
    this.search.set(search);
    this.categoryIds.set(categoryIds);
    this.dirtyVariants.set(new Map()); // Clean dirty state on filter reset
    this.loadProducts(0, false).subscribe();
  }

  updateVariantPrice(variantId: string, basePrice: number, discountPrice: number, variant: any) {
    // Validation Rules
    if (basePrice <= 0) return;
    if (discountPrice < 0 || discountPrice > basePrice) return;

    const currentDirty = new Map(this.dirtyVariants());
    
    // Calculate if it's actually dirty compared to original
    const isBaseChanged = basePrice !== variant.basePrice;
    const isDiscChanged = discountPrice !== (variant.discountPrice ?? variant.basePrice);

    if (isBaseChanged || isDiscChanged) {
      currentDirty.set(variantId, {
        basePrice,
        discountPrice,
        originalBasePrice: variant.basePrice,
        originalDiscountPrice: variant.discountPrice ?? variant.basePrice,
        discountPercent: this.calculateDiscountPercent(basePrice, discountPrice)
      });
    } else {
      currentDirty.delete(variantId);
    }
    
    this.dirtyVariants.set(currentDirty);
  }

  calculateDiscountPercent(base: number, disc: number): number {
    if (!base || base === 0) return 0;
    return Math.round(((base - disc) / base) * 100);
  }

  calculateDiscountPrice(base: number, percent: number): number {
    return Math.round(base * (1 - percent / 100));
  }

  bulkSave() {
    const shopId = this.shopContext.currentShopId();
    if (!shopId || !this.hasChanges()) return;

    this.isSaving.set(true);
    const updates: VariantPriceUpdate[] = Array.from(this.dirtyVariants().entries()).map(([id, state]) => ({
      variantId: id,
      basePrice: state.basePrice,
      discountPrice: state.discountPrice
    }));

    return this.api.bulkUpdateVariantPricing(shopId, { updates }).pipe(
      tap(() => {
        this.dirtyVariants.set(new Map());
        this.loadProducts(this.currentPage()).subscribe();
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  resetState() {
    this.products.set([]);
    this.dirtyVariants.set(new Map());
    this.currentPage.set(0);
  }
}
