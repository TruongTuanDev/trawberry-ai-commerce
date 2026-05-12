import {
  Component,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SellerInventoryFacade } from './seller-inventory.facade';
import { ReactiveFormsModule } from '@angular/forms';
import { TableWrapperComponent } from '../shared/table/table-wrapper.component';
import { Button } from '../../../shared/ui/button/button';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { ToastService } from '../../../core/services/toast.service';
import { InventoryConfirmationModalComponent } from './inventory-confirmation-modal.component';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableWrapperComponent,
    Button,
    BadgeComponent,
    InventoryConfirmationModalComponent,
  ],
  template: `
    <div class="space-y-6 pb-24">
      <div class="flex justify-between items-end">
        <div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Inventory Management</h1>
          <p class="text-gray-500 text-sm">
            Directly manage stock quantities across all product variants.
          </p>
        </div>

        @if (facade.hasChanges()) {
          <div
            class="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-blue-200 flex items-center gap-4 animate-in slide-in-from-bottom-4"
          >
            <span class="text-sm font-bold">{{ facade.changedCount() }} variants modified</span>
            <app-button (buttonClick)="showConfirmation.set(true)" variant="secondary"
              >Review & Save</app-button
            >
          </div>
        }
      </div>

      <div class="flex items-center gap-3">
        <div class="relative max-w-sm w-full">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            [value]="facade.search()"
            (input)="onSearch($event)"
            placeholder="Search by title, NM ID, article..."
            class="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
          />
        </div>

        <div class="relative">
          <button
            (click)="showCategoryFilter.set(!showCategoryFilter())"
            [class.bg-blue-50]="facade.categoryIds().length > 0"
            [class.border-blue-200]="facade.categoryIds().length > 0"
            class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg
              class="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Categories
            @if (facade.categoryIds().length > 0) {
              <span
                class="bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center"
                >{{ facade.categoryIds().length }}</span
              >
            }
          </button>

          @if (showCategoryFilter()) {
            <div
              class="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-30 animate-in fade-in slide-in-from-top-2"
            >
              <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
                <span class="text-[10px] font-black uppercase text-gray-400 tracking-widest"
                  >Select Categories</span
                >
                <button
                  (click)="clearCategories()"
                  class="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                >
                  Clear All
                </button>
              </div>
              <div class="max-h-60 overflow-y-auto space-y-1">
                @for (cat of facade.categoriesList(); track cat.id) {
                  <label
                    class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      [checked]="isCategorySelected(cat.id)"
                      (change)="toggleCategory(cat.id)"
                      class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span class="text-xs font-medium text-gray-700">{{ cat.name }}</span>
                    <span class="ml-auto text-[10px] text-gray-400 font-mono tracking-tighter">{{
                      cat.productCount
                    }}</span>
                  </label>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div
        class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]"
      >
        <app-table-wrapper>
          <thead>
            <tr>
              <th scope="col">Variant / Product</th>
              <th scope="col">Info</th>
              <th scope="col" class="w-32">Status</th>
              <th scope="col" class="w-24">Reserved</th>
              <th scope="col" class="w-32">Stock Qty</th>
            </tr>
          </thead>
          <tbody>
            @for (v of facade.variants(); track v.variantId) {
              <tr
                class="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0"
              >
                <td>
                  <div class="flex items-center gap-3">
                    <img
                      [src]="v.mainImage || '/assets/no-img.png'"
                      class="w-10 h-10 rounded-lg object-cover border border-gray-100 bg-gray-50"
                    />
                    <div>
                      <p
                        class="font-bold text-gray-900 truncate max-w-[300px] text-xs leading-tight"
                      >
                        {{ v.productTitle }}
                      </p>
                      <p
                        class="text-[10px] text-gray-400 font-mono tracking-tighter uppercase mt-0.5"
                      >
                        {{ v.categoryName }}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="space-y-0.5">
                    <div class="text-xs font-black text-gray-900">
                      Size: {{ v.techSize }}
                      <span class="text-gray-400 font-normal ml-1">({{ v.wbSize }})</span>
                    </div>
                    <div class="text-[10px] text-gray-400 font-mono tracking-tighter">
                      Art: {{ v.vendorCode }} | NM: {{ v.wbNmId }}
                    </div>
                  </div>
                </td>
                <td>
                  <app-badge [variant]="v.stockQuantity > 0 ? 'green' : 'red'">
                    {{ v.stockQuantity > 0 ? 'In Stock' : 'Out of Stock' }}
                  </app-badge>
                </td>
                <td>
                  <span class="text-xs font-bold text-gray-400">{{ v.reservedStock }}</span>
                </td>
                <td>
                  <div class="relative group">
                    <input
                      type="number"
                      [value]="getVariantQuantity(v.variantId, v.stockQuantity)"
                      (input)="onQuantityInput(v.variantId, $event, v.stockQuantity)"
                      class="w-24 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />

                    @if (isDirty(v.variantId)) {
                      <p
                        class="absolute top-full left-0 text-[10px] text-orange-500 font-bold mt-1 bg-white px-1 rounded shadow-sm z-10 animate-in fade-in slide-in-from-top-1"
                      >
                        <span class="opacity-60 font-medium tracking-tight">Was:</span>
                        {{ v.stockQuantity }}
                      </p>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              @if (!facade.loading()) {
                <tr>
                  <td colspan="5" class="py-24 text-center">
                    <div class="flex flex-col items-center grayscale opacity-50">
                      <svg
                        class="w-12 h-12 text-gray-300 mb-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                      <p class="text-gray-500 font-bold">No inventory found</p>
                      <p class="text-xs text-gray-400">
                        Try adjusting your filters or search terms
                      </p>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </app-table-wrapper>

        <div #sentinel class="h-10 flex items-center justify-center">
          @if (facade.loadingMore()) {
            <div class="flex items-center gap-2 text-gray-400">
              <span
                class="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"
              ></span>
              <span class="text-[10px] font-bold uppercase tracking-widest">Loading...</span>
            </div>
          }
        </div>
      </div>
    </div>

    @if (showConfirmation()) {
      <app-inventory-confirmation-modal
        (close)="showConfirmation.set(false)"
        (confirm)="onSave()"
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .animate-spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class InventoryListComponent implements AfterViewInit, OnDestroy {
  facade = inject(SellerInventoryFacade);
  private toast = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  showConfirmation = signal(false);
  showCategoryFilter = signal(false);

  @ViewChild('sentinel') sentinel?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    queueMicrotask(() => {
      this.setupInfiniteScroll();
    });
  }

  private setupInfiniteScroll(): void {
    if (!this.isBrowser) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (!this.sentinel?.nativeElement) return;

    this.observer?.disconnect();

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (this.facade.loadingMore()) return;
        if (this.facade.loading()) return;

        this.facade.loadNextPage();
      },
      { rootMargin: '200px 0px' },
    );

    this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.facade.setFilters(value, this.facade.categoryIds());
  }

  isCategorySelected(id: number): boolean {
    return this.facade.categoryIds().includes(id);
  }

  toggleCategory(id: number): void {
    const current = [...this.facade.categoryIds()];
    const index = current.indexOf(id);

    if (index > -1) current.splice(index, 1);
    else current.push(id);

    this.facade.setFilters(this.facade.search(), current);
  }

  clearCategories(): void {
    this.facade.setFilters(this.facade.search(), []);
  }

  isDirty(variantId: string): boolean {
    return this.facade.dirtyVariants().has(variantId);
  }

  getVariantQuantity(variantId: string, original: number): number {
    const dirty = this.facade.dirtyVariants().get(variantId);
    return dirty ? dirty.stockQuantity : original;
  }

  onQuantityInput(variantId: string, event: Event, original: number): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (isNaN(value)) return;

    this.facade.updateVariantQuantity(variantId, value, original);
  }

  onSave(): void {
    this.showConfirmation.set(false);

    this.facade.bulkSave()?.subscribe({
      next: () => {
        this.toast.success('Successfully updated inventory');
      },
      error: () => {
        this.toast.error('Failed to update stock quantity.');
      },
    });
  }
}
