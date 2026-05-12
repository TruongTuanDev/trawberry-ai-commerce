import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { ShopService } from '../../../core/services/shop.service';
import { SellerWbApiService } from '../../../core/api/seller-wb-api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-seller-shop-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6 max-w-3xl pb-12">
      <div>
        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Shop Settings</h1>
        <p class="text-gray-500">Manage your shop's public profile and Wildberries integration settings.</p>
      </div>

      @if (context.isLoading()) {
        <div class="py-12 flex justify-center">
          <span class="w-8 h-8 rounded-full border-4 border-gray-200 border-t-purple-600 animate-spin"></span>
        </div>
      } @else if (shop(); as s) {
        <!-- Shop Information Form -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-900 mb-4">Shop Information</h2>
          <form [formGroup]="shopInfoForm" (ngSubmit)="updateShopInfo()" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                <input formControlName="name" type="text"
                  class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Store Slug</label>
                <input formControlName="slug" type="text"
                  class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea formControlName="description" rows="2"
                class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500"></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contact Info (Support Email/Phone)</label>
              <input formControlName="contactInfo" type="text"
                class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
            </div>

            <div class="pt-4 border-t border-gray-100">
              <h3 class="text-sm font-bold text-gray-900 mb-4">Financial Details</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input formControlName="bankName" type="text"
                    class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">BIK</label>
                  <input formControlName="bik" type="text"
                    class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input formControlName="accountNumber" type="text"
                    class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                  <input formControlName="accountHolderName" type="text"
                    class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <button type="submit" [disabled]="shopInfoForm.invalid || infoSaving()"
                class="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black disabled:opacity-50 transition-colors">
                {{ infoSaving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>

        <!-- WB API Key Section -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-900 mb-2">Wildberries Integration</h2>
          <p class="text-sm text-gray-500 mb-4">
            Your API key is stored encrypted. Rotate it below to apply on the next sync cycle.
          </p>
          <form [formGroup]="apiKeyForm" (ngSubmit)="updateApiKey()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Wildberries API Key (v2)</label>
              <input formControlName="apiKey" type="password" autocomplete="new-password"
                placeholder="Paste new WB v2 API key here..."
                class="block w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-purple-500 focus:border-purple-500" />
            </div>
            <div class="flex justify-end">
              <button type="submit" [disabled]="apiKeyForm.invalid || apiSaving()"
                class="px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {{ apiSaving() ? 'Updating...' : 'Update API Key' }}
              </button>
            </div>
          </form>
        </div>
      } @else {
        <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm">
          No shop found or selected.
        </div>
      }
    </div>
  `
})
export class ShopSettingsComponent implements OnInit {
  public context = inject(ShopContextService);
  private shopService = inject(ShopService);
  private wbApi = inject(SellerWbApiService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  shop = this.context.currentShop;
  infoSaving = signal<boolean>(false);
  apiSaving = signal<boolean>(false);

  shopInfoForm = this.fb.group({
    name: ['', Validators.required],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    description: [''],
    contactInfo: [''],
    bankName: [''],
    accountNumber: [''],
    accountHolderName: [''],
    bik: [''],
    correspondentAccount: [''],
    paymentInstructions: ['']
  });

  apiKeyForm = this.fb.group({
    apiKey: ['', [Validators.required, Validators.minLength(20)]]
  });

  constructor() {
    // Keep form in sync with current shop
    effect(() => {
      const s = this.shop();
      if (s) {
        this.shopInfoForm.patchValue({
          name: s.name,
          slug: s.slug,
          description: s.description || '',
          contactInfo: s.contactInfo || '',
          bankName: s.bankName || '',
          accountNumber: s.accountNumber || '',
          accountHolderName: s.accountHolderName || '',
          bik: s.bik || '',
          correspondentAccount: s.correspondentAccount || '',
          paymentInstructions: s.paymentInstructions || ''
        }, { emitEvent: false });
      }
    });
  }

  ngOnInit() {
    // Shop details are automatically handled by ShopContextService based on route
  }

  updateShopInfo() {
    const shopId = this.context.currentShopId();
    if (this.shopInfoForm.invalid || !shopId) return;

    this.infoSaving.set(true);
    const data = this.shopInfoForm.value;

    this.shopService.updateShop(shopId, data as any).subscribe({
      next: () => {
        this.toast.success('Shop identity updated successfully.');
        this.infoSaving.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Failed to update shop identity');
        this.infoSaving.set(false);
      }
    });
  }

  updateApiKey() {
    const shopId = this.context.currentShopId();
    if (this.apiKeyForm.invalid || !shopId) return;

    this.apiSaving.set(true);
    const { apiKey } = this.apiKeyForm.value;
    
    this.wbApi.updateApiKey(shopId, apiKey!).subscribe({
      next: () => {
        this.toast.success('Wildberries API key updated successfully.');
        this.apiKeyForm.reset();
        this.apiSaving.set(false);
      },
      error: () => { 
        this.toast.error('Failed to update API key'); 
        this.apiSaving.set(false); 
      }
    });
  }
}
