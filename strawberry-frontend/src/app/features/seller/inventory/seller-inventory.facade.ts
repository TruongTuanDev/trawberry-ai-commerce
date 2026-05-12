import { Injectable, inject, signal, computed } from '@angular/core';
import { SellerProductApiService } from '../../../core/api/seller-product-api.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { VariantInventoryResponseDto, VariantInventoryUpdate, PageResponse } from '../../../core/models/product-dto.model';
import { finalize, tap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of, Observable } from 'rxjs';

export interface InventoryDirtyState {
  stockQuantity: number;
  originalQuantity: number;
}

@Injectable({ providedIn: 'root' })
export class SellerInventoryFacade {
  private api = inject(SellerProductApiService);
  private shopContext = inject(ShopContextService);

  // State
  variants = signal<VariantInventoryResponseDto[]>([]);
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
  inStock = signal<boolean | undefined>(undefined);

  // Metadata
  categoriesList = signal<any[]>([]);

  // Dirty State (Map variantId -> InventoryDirtyState)
  dirtyVariants = signal<Map<string, InventoryDirtyState>>(new Map());

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
        return this.loadVariants(0, false);
      })
    ).subscribe();
  }

  loadCategories(shopId: string) {
    this.api.getShopCategories(shopId).subscribe(list => {
      this.categoriesList.set(list);
    });
  }

  loadVariants(page = 0, append = false): Observable<any> {
    const shopId = this.shopContext.currentShopId();
    if (!shopId) return of(null);

    if (append) this.loadingMore.set(true);
    else this.loading.set(true);

    return this.api.getInventoryVariants(
      shopId,
      page,
      this.pageSize(),
      this.search(),
      this.categoryIds(),
      this.inStock()
    ).pipe(
      tap(res => {
        if (append) {
          this.variants.update(prev => [...prev, ...res.content]);
        } else {
          this.variants.set(res.content);
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
    this.loadVariants(this.currentPage() + 1, true).subscribe();
  }

  setFilters(search: string, categoryIds: number[]) {
    if (this.hasChanges() && !confirm('You have unsaved inventory changes. Discard them?')) {
      return;
    }
    
    this.search.set(search);
    this.categoryIds.set(categoryIds);
    this.dirtyVariants.set(new Map()); // Clean dirty state on filter reset
    this.loadVariants(0, false).subscribe();
  }

  updateVariantQuantity(variantId: string, quantity: number, originalQuantity: number) {
    if (quantity < 0) return;

    const currentDirty = new Map(this.dirtyVariants());
    
    if (quantity !== originalQuantity) {
      currentDirty.set(variantId, {
        stockQuantity: quantity,
        originalQuantity: originalQuantity
      });
    } else {
      currentDirty.delete(variantId);
    }
    
    this.dirtyVariants.set(currentDirty);
  }

  bulkSave() {
    const shopId = this.shopContext.currentShopId();
    if (!shopId || !this.hasChanges()) return;

    this.isSaving.set(true);
    const updates: VariantInventoryUpdate[] = Array.from(this.dirtyVariants().entries()).map(([id, state]) => ({
      variantId: id,
      stockQuantity: state.stockQuantity
    }));

    return this.api.bulkUpdateVariantInventory(shopId, { updates }).pipe(
      tap(() => {
        const savedDirty = new Map(this.dirtyVariants());
        this.dirtyVariants.set(new Map());
        // Update local state without full reload
        this.variants.update(list => list.map(v => {
          const change = savedDirty.get(v.variantId);
          if (change) {
            return { ...v, stockQuantity: change.stockQuantity };
          }
          return v;
        }));
      }),
      finalize(() => this.isSaving.set(false))
    );
  }

  resetState() {
    this.variants.set([]);
    this.dirtyVariants.set(new Map());
    this.currentPage.set(0);
  }
}
