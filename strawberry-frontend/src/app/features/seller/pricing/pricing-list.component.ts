import { Component, inject, signal, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SellerPricingFacade } from './seller-pricing.facade';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableWrapperComponent } from '../shared/table/table-wrapper.component';
import { Button } from '../../../shared/ui/button/button';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { ToastService } from '../../../core/services/toast.service';
import { PricingConfirmationModalComponent } from './pricing-confirmation-modal.component';

@Component({
  selector: 'app-pricing-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableWrapperComponent, Button, BadgeComponent, PricingConfirmationModalComponent],
  template: `
    <div class="space-y-6 pb-24">
      <div class="flex justify-between items-end">
        <div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Price Management</h1>
          <p class="text-gray-500 text-sm">Review and bulk update product pricing across all variants.</p>
        </div>

        @if (facade.hasChanges()) {
          <div class="bg-purple-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-purple-200 flex items-center gap-4 animate-in slide-in-from-bottom-4">
            <span class="text-sm font-bold">{{ facade.changedCount() }} variants modified</span>
            <app-button (buttonClick)="showConfirmation.set(true)" variant="secondary">Review & Save</app-button>
          </div>
        }
      </div>

      <!-- Search & Filters -->
      <div class="flex items-center gap-3">
        <div class="relative max-w-sm w-full">
           <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
           </svg>
           <input type="text" 
                  [value]="facade.search()" 
                  (input)="onSearch($event)" 
                  placeholder="Search products..." 
                  class="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium" />
        </div>

        <div class="relative">
           <button (click)="showCategoryFilter.set(!showCategoryFilter())" 
                   [class.bg-purple-50]="facade.categoryIds().length > 0"
                   [class.border-purple-200]="facade.categoryIds().length > 0"
                   class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
              <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter
              @if (facade.categoryIds().length > 0) {
                 <span class="bg-purple-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{{ facade.categoryIds().length }}</span>
              }
           </button>

           @if (showCategoryFilter()) {
              <div class="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-30 animate-in fade-in slide-in-from-top-2">
                 <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
                    <span class="text-[10px] font-black uppercase text-gray-400 tracking-widest">Categories</span>
                    <button (click)="clearCategories()" class="text-[10px] font-bold text-purple-600 hover:text-purple-700">Clear All</button>
                 </div>
                 <div class="max-h-60 overflow-y-auto space-y-1">
                    @for (cat of facade.categoriesList(); track cat.id) {
                       <label class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <input type="checkbox" 
                                 [checked]="isCategorySelected(cat.id)"
                                 (change)="toggleCategory(cat.id)"
                                 class="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300" />
                          <span class="text-xs font-medium text-gray-700">{{ cat.name }}</span>
                          <span class="ml-auto text-[10px] text-gray-400 font-mono tracking-tighter">{{ cat.productCount }}</span>
                       </label>
                    }
                 </div>
              </div>
           }
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
        <app-table-wrapper>
          <thead>
            <tr>
              <th scope="col" class="w-10"></th> <!-- Expand toggle column -->
              <th scope="col">Product</th>
              <th scope="col">Summary Price</th>
              <th scope="col" class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            @for (product of facade.products(); track product.id) {
              <tr class="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                <td>
                  <button (click)="toggleExpand(product.id)" class="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                    <svg class="w-5 h-5 transition-transform" [class.rotate-90]="expandedRows().has(product.id)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </td>
                <td>
                  <div class="flex items-center gap-3">
                    <img [src]="product.mainImage || '/assets/no-img.png'" class="w-10 h-10 rounded-lg object-cover border border-gray-100 bg-gray-50" />
                    <div>
                      <p class="font-bold text-gray-900 truncate max-w-[400px] text-sm leading-tight">{{ product.title }}</p>
                      <p class="text-[10px] text-gray-400 font-mono tracking-tighter uppercase mt-0.5">{{ product.vendorCode }} | NM: {{ product.wbNmId }}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="space-y-0.5">
                    @if (product.hasPriceRange) {
                       <div class="text-sm font-bold text-gray-900">{{ product.minDiscountPrice | number:'1.0-0' }} - {{ product.maxDiscountPrice | number:'1.0-0' }} RUB</div>
                       <div class="text-[10px] text-gray-400 italic">Base: {{ product.minBasePrice | number:'1.0-0' }} - {{ product.maxBasePrice | number:'1.0-0' }}</div>
                    } @else {
                       <div class="text-sm font-bold text-gray-900">{{ product.minDiscountPrice | number:'1.0-0' }} RUB</div>
                       <div class="text-[10px] text-gray-400 italic">Base: {{ product.minBasePrice | number:'1.0-0' }}</div>
                    }
                  </div>
                </td>
                <td class="text-right">
                   <span class="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-lg">
                      {{ variantCount(product) }} Variants
                   </span>
                </td>
              </tr>

              @if (expandedRows().has(product.id)) {
                <tr class="bg-gray-50/30">
                  <td colspan="4" class="p-0 border-t-0">
                    <div class="px-12 py-3 space-y-2 bg-gray-50/50">
                      @for (variant of product.variants; track variant.id) {
                        <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-6">
                           <div class="w-24 shrink-0">
                              <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">Size</p>
                              <p class="text-sm font-black text-gray-900 leading-tight">{{ variant.techSize }}</p>
                              <p class="text-[10px] text-gray-500">{{ variant.wbSize }}</p>
                           </div>

                           <div class="flex-1 grid grid-cols-4 gap-6 items-center">
                              <div class="max-w-[120px]">
                                 <label class="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Base Price</label>
                                 <input type="number" 
                                        [value]="getVariantValue(variant.id).basePrice"
                                        (input)="onPriceInput(variant.id, 'base', $event, product, variant)"
                                        class="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
                                 @if (isDirty(variant.id)) {
                                    <p class="text-[10px] text-orange-500 font-bold mt-1.5 animate-in fade-in slide-in-from-top-1">
                                       <span class="opacity-60 font-medium">Was:</span> {{ variant.basePrice | number:'1.0-0' }}
                                    </p>
                                 }
                              </div>

                              <div class="max-w-[100px]">
                                 <label class="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Discount %</label>
                                 <input type="number" 
                                        [value]="getVariantValue(variant.id).discountPercent"
                                        (input)="onPriceInput(variant.id, 'percent', $event, product, variant)"
                                        class="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
                              </div>

                              <div>
                                 <label class="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Final Price</label>
                                 <div class="h-8 flex items-center font-bold text-gray-900 text-base">
                                    {{ getVariantValue(variant.id).discountPrice | number:'1.0-0' }} <span class="text-[10px] ml-1 font-medium text-gray-400">RUB</span>
                                 </div>
                                 @if (isDirty(variant.id)) {
                                    <p class="text-[10px] text-orange-500 font-bold mt-1.5 animate-in fade-in slide-in-from-top-1">
                                       <span class="opacity-60 font-medium">Was:</span> {{ (variant.discountPrice ?? variant.basePrice) | number:'1.0-0' }}
                                    </p>
                                 }
                              </div>

                              <div class="flex flex-col items-center shrink-0">
                                 <label class="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Stock</label>
                                 <app-badge [variant]="variant.stockQuantity > 0 ? 'green' : 'red'">{{ variant.stockQuantity }}</app-badge>
                              </div>
                           </div>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              @if (!facade.loading()) {
               <tr><td colspan="4" class="py-24 text-center">
                  <div class="flex flex-col items-center grayscale opacity-50">
                     <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                     <p class="text-gray-500 font-bold">No products found</p>
                     <p class="text-xs text-gray-400">Try adjusting your filters or search terms</p>
                  </div>
               </td></tr>
              }
            }
          </tbody>
        </app-table-wrapper>

        <!-- Sentinel for Infinite Scroll -->
        <div #sentinel class="h-10 flex items-center justify-center">
           @if (facade.loadingMore()) {
              <div class="flex items-center gap-2 text-gray-400">
                 <span class="w-4 h-4 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin"></span>
                 <span class="text-[10px] font-bold uppercase tracking-widest">Loading more...</span>
              </div>
           }
        </div>
      </div>
    </div>

    @if (showConfirmation()) {
       <app-pricing-confirmation-modal 
         (close)="showConfirmation.set(false)"
         (confirm)="onSave()" />
    }
  `,
  styles: [`
    :host { display: block; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class PricingListComponent implements AfterViewInit, OnDestroy {
  facade = inject(SellerPricingFacade);
  private toast = inject(ToastService);

  expandedRows = signal<Set<string>>(new Set());
  showConfirmation = signal(false);
  showCategoryFilter = signal(false);
  
  @ViewChild('sentinel') sentinel!: ElementRef;
  private observer?: IntersectionObserver;

  ngAfterViewInit() {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this.facade.loadNextPage();
      }
    }, { rootMargin: '200px' });

    if (this.sentinel) {
      this.observer.observe(this.sentinel.nativeElement);
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  toggleExpand(id: string) {
    const current = new Set(this.expandedRows());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.expandedRows.set(current);
  }

  variantCount(product: any) {
    return product.variants?.length || 0;
  }

  onSearch(event: any) {
    this.facade.setFilters(event.target.value, this.facade.categoryIds());
  }

  isCategorySelected(id: number) {
    return this.facade.categoryIds().includes(id);
  }

  toggleCategory(id: number) {
    const current = [...this.facade.categoryIds()];
    const index = current.indexOf(id);
    if (index > -1) current.splice(index, 1);
    else current.push(id);
    this.facade.setFilters(this.facade.search(), current);
  }

  clearCategories() {
    this.facade.setFilters(this.facade.search(), []);
  }

  isDirty(variantId: string) {
    return this.facade.dirtyVariants().has(variantId);
  }

  getVariantValue(variantId: string) {
    const dirty = this.facade.dirtyVariants().get(variantId);
    if (dirty) return dirty;

    // Default from original
    const product = this.facade.products().find(p => p.variants.some(v => v.id === variantId));
    const variant = product?.variants.find(v => v.id === variantId);
    
    const base = variant?.basePrice || 0;
    const disc = variant?.discountPrice ?? base;
    
    return {
      basePrice: base,
      discountPrice: disc,
      discountPercent: this.facade.calculateDiscountPercent(base, disc)
    };
  }

  onPriceInput(variantId: string, type: 'base' | 'percent', event: any, product: any, variant: any) {
    const value = parseFloat(event.target.value) || 0;
    const current = this.getVariantValue(variantId);
    
    let base = current.basePrice;
    let disc = current.discountPrice;
    let percent = current.discountPercent;

    if (type === 'base') {
      base = value;
      disc = this.facade.calculateDiscountPrice(base, percent);
    } else {
      percent = Math.min(100, Math.max(0, value));
      disc = this.facade.calculateDiscountPrice(base, percent);
    }

    this.facade.updateVariantPrice(variantId, base, disc, variant);
  }

  onSave() {
    this.showConfirmation.set(false);
    this.facade.bulkSave()?.subscribe({
      next: () => {
        this.toast.success('Successfully updated pricing');
      },
      error: () => {
        this.toast.error('Failed to update variant pricing.');
      }
    });
  }
}
