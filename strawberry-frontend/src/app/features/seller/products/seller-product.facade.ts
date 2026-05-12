import { Injectable, inject, signal } from '@angular/core';
import { SellerProductApiService } from '../../../core/api/seller-product-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { 
  ProductResponseDto, 
  ProductDetailResponseDto,
  ProductMetadataRequestDto,
  VariantPricingRequestDto,
  VariantInventoryRequestDto,
  CategoryResponseDto
} from '../../../core/models/product-dto.model';
import { finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SellerProductFacade {
  private api = inject(SellerProductApiService);
  private toast = inject(ToastService);
  private context = inject(ShopContextService);

  // --- List State ---
  products = signal<ProductResponseDto[]>([]);
  totalElements = signal<number>(0);
  totalPages = signal<number>(0);
  currentPage = signal<number>(0);
  pageSize = signal<number>(20);
  listLoading = signal<boolean>(false);
  hasMore = signal<boolean>(true);

  // --- Filter State ---
  searchQuery = signal<string>('');
  filterWbId = signal<number | undefined>(undefined);
  filterCategoryIds = signal<number[]>([]);
  filterVisibility = signal<string | undefined>(undefined);
  filterInStock = signal<boolean | undefined>(undefined);

  // --- Detail State ---
  currentProduct = signal<ProductDetailResponseDto | null>(null);
  detailLoading = signal<boolean>(false);

  // --- Categories ---
  categories = signal<CategoryResponseDto[]>([]);
  categoriesLoading = signal<boolean>(false);

  loadProducts(page = 0, append = false) {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    if (page === 0 && !append) {
      this.products.set([]);
      this.hasMore.set(true);
      this.currentPage.set(0);
    }

    if (!this.hasMore() && append) return;

    this.listLoading.set(true);
    this.api.getProducts(
      shopId,
      page,
      this.pageSize(),
      this.searchQuery() || undefined,
      this.filterWbId(),
      this.filterCategoryIds(),
      this.filterVisibility(),
      this.filterInStock()
    ).pipe(
      finalize(() => this.listLoading.set(false))
    ).subscribe({
      next: (res) => {
        if (append) {
          this.products.update(prev => [...prev, ...res.content]);
        } else {
          this.products.set(res.content);
        }
        this.currentPage.set(res.number);
        this.totalPages.set(res.totalPages);
        this.totalElements.set(res.totalElements);
        this.hasMore.set(res.number < res.totalPages - 1);
      },
      error: () => this.toast.error('Failed to load seller products')
    });
  }

  /**
   * Explicitly load the next batch of products.
   * Centralized logic for infinite scroll triggers.
   */
  loadNextPage() {
    if (this.listLoading() || !this.hasMore()) {
      return;
    }

    const nextPage = this.currentPage() + 1;
    this.loadProducts(nextPage, true);
  }

  loadCategories() {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.categoriesLoading.set(true);
    this.api.getShopCategories(shopId).pipe(
      finalize(() => this.categoriesLoading.set(false))
    ).subscribe({
      next: (res) => this.categories.set(res),
      error: () => this.toast.error('Failed to load categories')
    });
  }

  setFilters(filters: { search?: string, wbId?: number, categoryIds?: number[], visibility?: string, inStock?: boolean }) {
    if ('search' in filters) this.searchQuery.set(filters.search || '');
    if ('wbId' in filters) this.filterWbId.set(filters.wbId);
    if ('categoryIds' in filters) this.filterCategoryIds.set(filters.categoryIds || []);
    if ('visibility' in filters) this.filterVisibility.set(filters.visibility);
    if ('inStock' in filters) this.filterInStock.set(filters.inStock);
    
    // Explicit reset to ensure observer finds anchor again if list shrinks/clears
    this.hasMore.set(true); 
    this.loadProducts(0, false);
  }

  setPage(pageIndex: number) {
    // Keep for backward compatibility or direct jumps if needed
    this.loadProducts(pageIndex, pageIndex > 0);
  }

  loadProductDetail(id: string) {
    const shopId = this.context.currentShopId();
    if (!shopId) return;

    this.detailLoading.set(true);
    this.api.getProductDetail(shopId, id).pipe(
      finalize(() => this.detailLoading.set(false))
    ).subscribe({
      next: (res) => this.currentProduct.set(res),
      error: () => {
        this.toast.error('Failed to load product details');
        this.currentProduct.set(null);
      }
    });
  }

  updateMetadata(productId: string, request: ProductMetadataRequestDto) {
    const shopId = this.context.currentShopId();
    if (!shopId) throw new Error('No active shop context');
    return this.api.updateMetadata(shopId, productId, request);
  }

  updateVariantPricing(variantId: string, request: VariantPricingRequestDto) {
    const shopId = this.context.currentShopId();
    if (!shopId) throw new Error('No active shop context');
    return this.api.updatePricing(shopId, variantId, request);
  }

  updateVariantInventory(variantId: string, request: VariantInventoryRequestDto) {
    const shopId = this.context.currentShopId();
    if (!shopId) throw new Error('No active shop context');
    return this.api.updateInventory(shopId, variantId, request);
  }
}
