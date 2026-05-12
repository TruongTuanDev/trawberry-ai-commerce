import { Component, EventEmitter, Output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SellerInventoryFacade } from './seller-inventory.facade';
import { Button } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-inventory-confirmation-modal',
  standalone: true,
  imports: [CommonModule, Button],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" (click)="close.emit()"></div>
      
      <div class="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 class="text-xl font-black text-gray-900 tracking-tight">Confirm Inventory Changes</h2>
            <p class="text-sm text-gray-500">Review stock updates before applying them.</p>
          </div>
          <button (click)="close.emit()" class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          @for (change of changedVariants(); track change.variantId) {
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm transition-all hover:bg-gray-100/50">
              <img [src]="change.mainImage || '/assets/no-img.png'" class="w-12 h-12 rounded-xl object-cover border border-white shadow-sm" />
              
              <div class="flex-1 min-w-0">
                <p class="text-sm font-black text-gray-900 truncate tracking-tight">{{ change.productTitle }}</p>
                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  {{ change.techSize }} <span class="text-gray-300 mx-1">|</span> NM: {{ change.wbNmId }}
                </p>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <div class="text-right">
                  <p class="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1">Stock</p>
                  <div class="flex items-center gap-2">
                     <span class="text-xs font-bold text-gray-400 line-through decoration-gray-300">{{ change.oldQuantity }}</span>
                     <svg class="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                     </svg>
                     <span class="text-sm font-black text-blue-600">{{ change.newQuantity }}</span>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="p-6 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {{ facade.changedCount() }} updates pending
          </div>
          <div class="flex gap-3">
            <app-button (buttonClick)="close.emit()" variant="outline">Cancel</app-button>
            <app-button (buttonClick)="confirm.emit()" [loading]="facade.isSaving()">Confirm & Save</app-button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class InventoryConfirmationModalComponent {
  facade = inject(SellerInventoryFacade);
  
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  changedVariants = computed(() => {
    const dirty = this.facade.dirtyVariants();
    const list = this.facade.variants();
    const result: any[] = [];
    
    dirty.forEach((state, id) => {
      const v = list.find(item => item.variantId === id);
      result.push({
        variantId: id,
        productTitle: v?.productTitle || 'Unknown Product',
        mainImage: v?.mainImage,
        techSize: v?.techSize,
        wbNmId: v?.wbNmId,
        oldQuantity: state.originalQuantity,
        newQuantity: state.stockQuantity
      });
    });
    return result;
  });
}
