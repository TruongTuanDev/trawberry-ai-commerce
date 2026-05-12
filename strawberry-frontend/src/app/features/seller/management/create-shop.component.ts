import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ShopService } from '../../../core/services/shop.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-create-shop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md md:max-w-xl lg:max-w-4xl mx-auto">
        <div class="mb-8 flex items-center">
          <a routerLink="/seller" class="mr-4 text-slate-400 hover:text-slate-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </a>
          <h1 class="text-2xl font-bold text-slate-900">Create New Shop</h1>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form [formGroup]="shopForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="name" class="block text-sm font-medium text-slate-700">Shop Name</label>
                <div class="mt-1">
                  <input
                    id="name"
                    type="text"
                    formControlName="name"
                    placeholder="e.g. My Fashion Hub"
                    class="block w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <p
                  *ngIf="
                    shopForm.get('name')?.touched && shopForm.get('name')?.errors?.['required']
                  "
                  class="mt-1 text-xs text-red-500"
                >
                  Name is required
                </p>
              </div>

              <div>
                <label for="slug" class="block text-sm font-medium text-slate-700"
                  >Store Slug</label
                >
                <div class="mt-1 flex rounded-lg shadow-sm">
                  <input
                    id="slug"
                    type="text"
                    formControlName="slug"
                    placeholder="my-fashion-hub"
                    class="flex-1 block w-full px-4 py-3 rounded-l-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <span
                    class="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 text-slate-500 text-sm"
                  >
                    .strawberry.com
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 italic">
                  This will be your primary store URL.
                </p>
                <p
                  *ngIf="
                    shopForm.get('slug')?.touched && shopForm.get('slug')?.errors?.['required']
                  "
                  class="mt-1 text-xs text-red-500"
                >
                  Slug is required
                </p>
                <p
                  *ngIf="shopForm.get('slug')?.touched && shopForm.get('slug')?.errors?.['pattern']"
                  class="mt-1 text-xs text-red-500"
                >
                  Only lowercase, numbers and hyphens
                </p>
              </div>
            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-slate-700"
                >Description (Optional)</label
              >
              <div class="mt-1">
                <textarea
                  id="description"
                  formControlName="description"
                  rows="2"
                  class="block w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                ></textarea>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100">
              <h3 class="text-sm font-bold text-slate-900 mb-4">Financial & Contact Details</h3>

              <div class="space-y-4">
                <div>
                  <label for="contactInfo" class="block text-sm font-medium text-slate-700"
                    >Contact Info (e.g. Support Email/Phone)</label
                  >
                  <input
                    id="contactInfo"
                    type="text"
                    formControlName="contactInfo"
                    class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="bankName" class="block text-sm font-medium text-slate-700"
                      >Bank Name</label
                    >
                    <input
                      id="bankName"
                      type="text"
                      formControlName="bankName"
                      class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label for="bik" class="block text-sm font-medium text-slate-700">BIK</label>
                    <input
                      id="bik"
                      type="text"
                      formControlName="bik"
                      class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label for="accountNumber" class="block text-sm font-medium text-slate-700"
                    >Account Number</label
                  >
                  <input
                    id="accountNumber"
                    type="text"
                    formControlName="accountNumber"
                    class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label for="accountHolderName" class="block text-sm font-medium text-slate-700"
                    >Account Holder Name</label
                  >
                  <input
                    id="accountHolderName"
                    type="text"
                    formControlName="accountHolderName"
                    class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label for="correspondentAccount" class="block text-sm font-medium text-slate-700"
                    >Correspondent Account (Optional)</label
                  >
                  <input
                    id="correspondentAccount"
                    type="text"
                    formControlName="correspondentAccount"
                    class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label for="paymentInstructions" class="block text-sm font-medium text-slate-700"
                    >Payment Instructions (Optional)</label
                  >
                  <textarea
                    id="paymentInstructions"
                    formControlName="paymentInstructions"
                    rows="3"
                    class="mt-1 block w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all"
                  ></textarea>
                </div>
              </div>
            </div>

            <button
              type="submit"
              [disabled]="shopForm.invalid || isSubmitting()"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span *ngIf="!isSubmitting()">Create Shop</span>
              <span *ngIf="isSubmitting()" class="flex items-center">
                <svg
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class CreateShopComponent implements OnInit {
  private fb = inject(FormBuilder);
  private shopService = inject(ShopService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  isSubmitting = signal(false);

  shopForm = this.fb.group({
    name: ['', Validators.required],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    description: [''],
    contactInfo: [''],
    bankName: [''],
    accountNumber: [''],
    accountHolderName: [''],
    bik: [''],
    correspondentAccount: [''],
    paymentInstructions: [''],
  });

  ngOnInit() {
    this.shopService.getSellerWorkspace().subscribe({
      next: (workspace) => {
        if (workspace.approvalStatus !== 'APPROVED') {
          this.router.navigate(['/seller']);
          return;
        }

        if (workspace.currentShop?.id) {
          this.router.navigate(['/seller/shops', workspace.currentShop.id, 'dashboard']);
        }
      },
    });
  }

  onSubmit() {
    if (this.shopForm.valid) {
      this.isSubmitting.set(true);
      const data = this.shopForm.value;

      this.shopService.createShop(data as any).subscribe({
        next: (shop) => {
          this.toastService.success('Shop created successfully!');
          this.router.navigate(['/seller/shops', shop.id, 'dashboard']);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.toastService.error(err.error?.message || 'Failed to create shop');
        },
      });
    }
  }
}
