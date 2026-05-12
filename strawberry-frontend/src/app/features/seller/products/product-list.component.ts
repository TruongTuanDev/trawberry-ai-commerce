import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SellerProductFacade } from './seller-product.facade';
import { CategoryFilterComponent } from './category-filter.component';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { TableWrapperComponent } from '../shared/table/table-wrapper.component';
import { FilterBarComponent } from '../shared/table/filter-bar.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-seller-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TableWrapperComponent,
    FilterBarComponent,
    CategoryFilterComponent,
    BadgeComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Products List</h1>
          <p class="text-gray-500">Manage your catalog, metadata, and visibility.</p>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-6 items-start">
        <!-- Dashboard Sidebar / Filters -->
        <aside class="w-full lg:w-64 flex-shrink-0">
          <app-category-filter
            [categories]="facade.categories()"
            [selectedIds]="facade.filterCategoryIds()"
            (selectionChange)="onCategoryChange($event)"
          ></app-category-filter>
        </aside>

        <!-- Main Product Area -->
        <div class="flex-grow min-w-0 w-full space-y-6">
          <app-filter-bar
            placeholder="Search by product name, WB ID, brand or Vendor Code..."
            (searchQuery)="onSearch($event)"
          >
            <select
              class="block w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl bg-white focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              (change)="onVisibilityChange($event)"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              class="block w-full pl-3 pr-10 py-2 border border-gray-200 rounded-xl bg-white focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              (change)="onStockChange($event)"
            >
              <option value="">All Stock</option>
              <option value="true">In Stock</option>
              <option value="false">Out of Stock</option>
            </select>
          </app-filter-bar>

          <app-table-wrapper>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col" class="text-right">Action</th>
              </tr>
            </thead>
            <tbody class="bg-white">
              @for (product of facade.products(); track product.id) {
                <tr class="hover:bg-gray-50/50 transition-colors">
                  <td class="whitespace-nowrap flex items-center gap-4">
                    <img
                      [src]="product.mainImage || '/assets/no-img.png'"
                      class="w-12 h-16 object-cover rounded shadow-sm border border-gray-100"
                    />
                    <div class="min-w-0">
                      <p class="text-sm font-bold text-gray-900 truncate max-w-[200px] xl:max-w-xs">
                        {{ product.title }}
                      </p>
                      <p class="text-xs text-gray-500 truncate">WB Id: {{ product.wbNmId }}</p>
                      <p class="text-xs text-gray-500 truncate">
                        Article: {{ product.vendorCode }}
                      </p>
                    </div>
                  </td>
                  <td class="whitespace-nowrap">
                    <div class="flex flex-col">
                      <span class="font-bold text-gray-900">{{
                        product.discountPrice || product.minPrice
                          | currency: 'RUB' : 'symbol-narrow' : '1.0-0'
                      }}</span>
                      <span
                        class="text-xs"
                        [class.text-red-500]="!product.inStock"
                        [class.text-green-600]="product.inStock"
                      >
                        {{ product.inStock ? 'In Stock' : 'Out of Stock' }}
                      </span>
                    </div>
                  </td>
                  <td class="whitespace-nowrap text-sm text-gray-500">
                    {{ product.categoryName }}
                  </td>
                  <td class="whitespace-nowrap">
                    <app-badge [variant]="product.inStock ? 'green' : 'gray'">
                      {{ product.inStock ? 'Active' : 'Missing Stock' }}
                    </app-badge>
                  </td>
                  <td class="whitespace-nowrap text-right text-sm font-medium">
                    <a
                      [routerLink]="['/seller/products', product.id]"
                      class="text-purple-600 hover:text-purple-900 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                      >Manage</a
                    >
                  </td>
                </tr>
              }

              @if (facade.products().length === 0 && !facade.listLoading()) {
                <tr>
                  <td colspan="5">
                    <app-empty-state
                      title="No products found"
                      description="Try adjusting your search or filters to find what you're looking for."
                    >
                      <svg
                        icon
                        class="w-12 h-12 relative z-10"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                    </app-empty-state>
                  </td>
                </tr>
              }
            </tbody>
          </app-table-wrapper>

          <!-- Infinite Scroll Anchor -->
          <div #scrollAnchor class="py-8 flex flex-col items-center justify-center gap-4">
            <app-loading-spinner *ngIf="facade.listLoading()"></app-loading-spinner>

            @if (!facade.hasMore() && facade.products().length > 0) {
              <div class="flex flex-col items-center text-slate-400">
                <div class="h-px w-24 bg-slate-200 mb-2"></div>
                <p class="text-xs font-medium uppercase tracking-widest italic">End of Catalog</p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProductListComponent implements OnInit, AfterViewInit, OnDestroy {
  facade = inject(SellerProductFacade);
  context = inject(ShopContextService);
  destroyRef = inject(DestroyRef);

  @ViewChild('scrollAnchor') scrollAnchor!: ElementRef;
  private observer?: IntersectionObserver;

  ngOnInit() {
    // Initial load
    this.refreshAll();

    // React to shop changes
    this.context.shopChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshAll();
    });
  }

  ngAfterViewInit() {
    this.initInfiniteScroll();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private refreshAll() {
    this.facade.loadCategories();
    this.facade.loadProducts(0, false);
  }

  private initInfiniteScroll() {
    this.observer?.disconnect();

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.facade.loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: '200px', // Start loading before reaching the bottom
        threshold: 0.1,
      },
    );

    this.observer.observe(this.scrollAnchor.nativeElement);
  }

  onSearch(query: string) {
    this.facade.setFilters({ search: query || undefined });
  }

  onVisibilityChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.facade.setFilters({ visibility: val || undefined });
  }

  onStockChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    let inStock: boolean | undefined = undefined;
    if (val === 'true') inStock = true;
    if (val === 'false') inStock = false;
    this.facade.setFilters({ inStock });
  }

  onCategoryChange(categoryIds: number[]) {
    this.facade.setFilters({ categoryIds });
  }
}
