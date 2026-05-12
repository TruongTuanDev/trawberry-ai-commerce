import { Component, EventEmitter, Output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SellerPricingFacade } from './seller-pricing.facade';
import { Button } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-pricing-confirmation-modal',
  standalone: true,
  imports: [CommonModule, Button],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" (click)="close.emit()"></div>
      
      <div class="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 class="text-xl font-black text-gray-900 tracking-tight">Confirm Price Changes</h2>
            <p class="text-sm text-gray-500">Please review the summary of modified variants below.</p>
          </div>
          <button (click)="close.emit()" class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-8">
           @for (group of groupedChanges(); track group.productId) {
              <div class="space-y-3">
                 <div class="flex items-center gap-3">
                    <img [src]="group.mainImage || '/assets/no-img.png'" class="w-8 h-8 rounded-lg object-cover" />
                    <div>
                       <h3 class="font-bold text-gray-900 text-sm leading-none">{{ group.title }}</h3>
                       <p class="text-[10px] text-gray-400 uppercase tracking-tighter mt-1">{{ group.vendorCode }} | NM: {{ group.wbNmId }}</p>
                    </div>
                 </div>

                 <div class="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                    <table class="w-full text-left text-xs">
                       <thead class="bg-gray-100/50 text-gray-500 font-bold uppercase tracking-widest">
                          <tr>
                             <th class="px-4 py-2">Size</th>
                             <th class="px-4 py-2 text-center">Action</th>
                             <th class="px-4 py-2">Base Price</th>
                             <th class="px-4 py-2">Final Price</th>
                          </tr>
                       </thead>
                       <tbody class="divide-y divide-gray-100">
                          @for (change of group.variants; track change.variantId) {
                             <tr>
                                <td class="px-4 py-3 font-semibold text-gray-900">{{ change.techSize }}</td>
                                <td class="px-4 py-3 text-center">
                                   <span class="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-black uppercase">Modified</span>
                                </td>
                                <td class="px-4 py-3">
                                   <div class="flex items-center gap-2">
                                      <span class="text-gray-400 line-through">{{ change.oldBase | number:'1.0-0' }}</span>
                                      <svg class="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                      <span class="font-black text-gray-900">{{ change.newBase | number:'1.0-0' }}</span>
                                   </div>
                                </td>
                                <td class="px-4 py-3">
                                   <div class="flex items-center gap-2">
                                      <span class="text-gray-400 line-through">{{ change.oldDisc | number:'1.0-0' }}</span>
                                      <svg class="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                      <span class="font-black text-purple-600">{{ change.newDisc | number:'1.0-0' }}</span>
                                   </div>
                                </td>
                             </tr>
                          }
                       </tbody>
                    </table>
                 </div>
              </div>
           }
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
           <div class="text-sm font-medium text-gray-500">
              Total {{ facade.changedCount() }} variants will be updated.
           </div>
            <div class="flex gap-3">
               <app-button variant="secondary" (buttonClick)="close.emit()">Cancel</app-button>
               <app-button (buttonClick)="confirm.emit()" [loading]="facade.isSaving()">Confirm & Save Changes</app-button>
            </div>
        </div>
      </div>
    </div>
  `
})
export class PricingConfirmationModalComponent {
  facade = inject(SellerPricingFacade);
  
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  groupedChanges = computed(() => {
    const dirty = this.facade.dirtyVariants();
    const products = this.facade.products();
    const groups: any[] = [];

    dirty.forEach((state, variantId) => {
      const product = products.find(p => p.variants.some(v => v.id === variantId));
      if (!product) return;

      const variant = product.variants.find(v => v.id === variantId)!;
      let group = groups.find(g => g.productId === product.id);
      
      if (!group) {
        group = {
          productId: product.id,
          title: product.title,
          wbNmId: product.wbNmId,
          vendorCode: product.vendorCode,
          mainImage: product.mainImage,
          variants: []
        };
        groups.push(group);
      }

      group.variants.push({
        variantId,
        techSize: variant.techSize,
        oldBase: state.originalBasePrice,
        newBase: state.basePrice,
        oldDisc: state.originalDiscountPrice,
        newDisc: state.discountPrice
      });
    });

    return groups;
  });
}
