import { Component, inject, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SellerProductFacade } from './seller-product.facade';
import { InputComponent } from '../../../shared/ui/input/input';
import { Button } from '../../../shared/ui/button/button';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { TableWrapperComponent } from '../shared/table/table-wrapper.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-seller-product-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, InputComponent, Button, TableWrapperComponent
  ],
  template: `
    <div class="space-y-6 max-w-5xl pb-12">
      <div class="flex items-center gap-4">
        <a routerLink="/seller/products" class="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </a>
        <div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Product Editor</h1>
          <p class="text-gray-500">Metadata & Inventory Management</p>
        </div>
      </div>

      @if (facade.detailLoading()) {
        <div class="py-12 flex justify-center">
          <span class="w-8 h-8 rounded-full border-4 border-gray-200 border-t-purple-600 animate-spin"></span>
        </div>
      } @else if (facade.currentProduct(); as product) {
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Column 1: Editable Metadata -->
          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 class="text-lg font-bold text-gray-900 mb-4">Metadata Settings</h2>
              
              <form [formGroup]="metadataForm" (ngSubmit)="saveMetadata()" class="space-y-4">
                <app-input formControlName="localTitle" label="Local Title (Overrides WB Name)" placeholder="Custom product name"></app-input>
                
                <div>
                  <label class="label">Local Description (Overrides WB Description)</label>
                  <textarea formControlName="localDescription" rows="4" class="block w-full border border-gray-200 rounded-xl bg-white focus:ring-purple-500 focus:border-purple-500 sm:text-sm p-3"></textarea>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <app-input formControlName="slugOverride" label="SEO Slug Override" placeholder="e.g., custom-shoes-2026"></app-input>
                  
                  <div>
                    <label class="label">Storefront Visibility</label>
                    <select formControlName="visibility" class="block w-full pl-3 pr-10 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-purple-500 focus:border-purple-500 sm:text-sm">
                      <option value="ACTIVE">Active (Visible)</option>
                      <option value="DRAFT">Draft (Hidden)</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </div>

                <div class="pt-4 flex justify-end">
                  <app-button type="submit" [loading]="savingMetadata()" [disabled]="metadataForm.invalid || savingMetadata()">Save Metadata</app-button>
                </div>
              </form>
            </div>

            <!-- Variants Table -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 overflow-hidden">
               <h2 class="text-lg font-bold text-gray-900 mb-4">Variant Pricing & Inventory</h2>
               
               <app-table-wrapper>
                  <thead>
                    <tr>
                      <th scope="col">Tech Size</th>
                      <th scope="col">WB Size</th>
                      <th scope="col">Base (RUB)</th>
                      <th scope="col">Discount (RUB)</th>
                      <th scope="col">Stock</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (variant of product.variants; track variant.id; let i = $index) {
                      <tr [formGroup]="getVariantForm(i)">
                        <td class="whitespace-nowrap font-medium text-gray-900">{{ variant.techSize }}</td>
                        <td class="whitespace-nowrap text-gray-500">{{ variant.wbSize }}</td>
                        <td>
                          <input type="number" formControlName="basePrice" class="block w-24 border border-gray-200 rounded-md py-1.5 px-2 text-sm" />
                        </td>
                        <td>
                          <input type="number" formControlName="discountPrice" class="block w-24 border border-gray-200 rounded-md py-1.5 px-2 text-sm" />
                        </td>
                        <td>
                          <input type="number" formControlName="stockQuantity" class="block w-20 border border-gray-200 rounded-md py-1.5 px-2 text-sm" />
                        </td>
                        <td class="text-right">
                          <button type="button" (click)="saveVariant(variant.id, i)" [disabled]="savingVariantId() === variant.id" class="text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            {{ savingVariantId() === variant.id ? 'Saving...' : 'Save' }}
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
               </app-table-wrapper>
            </div>
          </div>

          <!-- Column 2: Read-only WB Sync Data -->
          <div class="space-y-6">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div class="aspect-w-3 aspect-h-4 bg-gray-100">
                  <img [src]="product.images[0] || '/assets/no-img.png'" class="object-cover w-full h-64" />
               </div>
               <div class="p-5">
                  <h3 class="font-bold text-gray-900 mb-1">Wildberries Identity</h3>
                  <div class="text-sm text-gray-500 space-y-2 mt-3">
                     <p><span class="font-medium text-gray-700">Brand:</span> {{ product.brand }}</p>
                     <p><span class="font-medium text-gray-700">Category:</span> {{ product.category.name }}</p>
                     <p *ngIf="product.wbNmId"><span class="font-medium text-gray-700">NM ID:</span> {{ product.wbNmId }}</p>
                     <p><span class="font-medium text-gray-700">Original Title:</span> {{ product.title }}</p>
                  </div>
                  
                  <h3 class="font-bold text-gray-900 mt-6 mb-2">Characteristics</h3>
                  <div class="flex flex-wrap gap-2 text-xs">
                    @for (char of product.characteristics | slice:0:10; track char.name) {
                      <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded">{{ char.name }}: {{ char.value }}</span>
                    }
                    @if (product.characteristics.length > 10) {
                      <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded">+{{ product.characteristics.length - 10 }} more</span>
                    }
                  </div>
               </div>
            </div>
          </div>
          
        </div>
      } @else {
        <div class="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
          Product not found or failed to load.
        </div>
      }
    </div>
  `
})
export class ProductDetailComponent implements OnInit {
  facade = inject(SellerProductFacade);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  productId!: string;
  
  metadataForm = this.fb.group({
    localTitle: [''],
    localDescription: [''],
    visibility: ['ACTIVE'],
    slugOverride: ['']
  });

  // Since variants dynamically load, we store a map or array of FormGroups for them
  // A simple array of FormGroups populated via an effect
  variantForms: FormGroup[] = [];

  savingMetadata = signal(false);
  savingVariantId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const product = this.facade.currentProduct();
      if (product) {
        // Assume visibility might be patched if we had the field, else default
        this.metadataForm.patchValue({
          localTitle: product.title, // In a real scenario, this would map `localTitle` if provided by DTO
          localDescription: product.description,
          visibility: 'ACTIVE',
          slugOverride: product.slug
        });

        this.variantForms = product.variants.map(v => this.fb.group({
          basePrice: [v.basePrice, [Validators.required, Validators.min(0)]],
          discountPrice: [v.discountPrice],
          stockQuantity: [v.stockQuantity, [Validators.required, Validators.min(0)]]
        }));
      }
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productId = id;
      this.facade.loadProductDetail(id);
    }
  }

  getVariantForm(index: number): FormGroup {
    return this.variantForms[index];
  }

  saveMetadata() {
    if (this.metadataForm.invalid) return;
    this.savingMetadata.set(true);
    const { localTitle, localDescription, visibility, slugOverride } = this.metadataForm.value;
    
    this.facade.updateMetadata(this.productId, {
      localTitle: localTitle || undefined,
      localDescription: localDescription || undefined,
      visibility: visibility || undefined,
      slugOverride: slugOverride || undefined
    }).subscribe({
      next: () => {
        this.toast.success('Metadata updated successfully');
        this.savingMetadata.set(false);
      },
      error: () => {
        this.toast.error('Failed to update metadata');
        this.savingMetadata.set(false);
      }
    });
  }

  saveVariant(variantId: string, index: number) {
    const form = this.variantForms[index];
    if (form.invalid) {
      this.toast.error('Invalid variant values');
      return;
    }
    
    this.savingVariantId.set(variantId);
    const { basePrice, discountPrice, stockQuantity } = form.value;

    // Execute pricing + inventory in parallel (or just sequentially if prefer)
    // The backend uses two separate endpoints. We will chain them or forkJoin.
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        pricing: this.facade.updateVariantPricing(variantId, { basePrice, discountPrice }),
        inventory: this.facade.updateVariantInventory(variantId, { stockQuantity })
      }).subscribe({
        next: () => {
          this.toast.success('Variant updated successfully');
          this.savingVariantId.set(null);
        },
        error: () => {
          this.toast.error('Failed to update variant');
          this.savingVariantId.set(null);
        }
      });
    });
  }
}
