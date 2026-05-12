import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { SellerDashboardService, SellerDashboardStats } from '../../../core/services/seller-dashboard.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-seller-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  providers: [CurrencyPipe, DatePipe],
  template: `
    <div class="space-y-8">
      <!-- Welcome Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Seller Dashboard</h1>
          <p class="text-gray-500 mt-1">Welcome back. Here's a quick overview of your shop.</p>
        </div>
        @if (shop(); as s) {
          <div class="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2">
            <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span class="text-sm font-bold text-purple-800">{{ s.name }}</span>
          </div>
        }
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            @for (i of [1,2,3,4]; track i) {
                <div class="h-24 bg-gray-200 rounded-2xl"></div>
            }
        </div>
      } @else {
        <!-- Quick Stats Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a [routerLink]="['/seller/shops', shopId(), 'products']" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-purple-300 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start">
                <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Products</p>
                <p class="text-3xl font-black text-gray-900 mt-1">{{ stats()?.productCount || 0 }}</p>
                </div>
                <div class="p-2 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                <svg class="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10L4 7v10l8 4" />
                </svg>
                </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">In your catalog →</p>
            </a>

            <a [routerLink]="['/seller/shops', shopId(), 'orders']" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-purple-300 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start">
                <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Orders</p>
                <p class="text-3xl font-black text-gray-900 mt-1">{{ stats()?.orderCount || 0 }}</p>
                </div>
                <div class="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                <svg class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">Manage fulfillment →</p>
            </a>

            <a [routerLink]="['/seller/shops', shopId(), 'payments']" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-purple-300 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start">
                <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Pending Payments</p>
                <p class="text-3xl font-black text-gray-900 mt-1">{{ stats()?.pendingPaymentCount || 0 }}</p>
                </div>
                <div class="p-2 bg-yellow-50 rounded-xl group-hover:bg-yellow-100 transition-colors">
                <svg class="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">Review payments →</p>
            </a>

            <a [routerLink]="['/seller/shops', shopId(), 'sync']" class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:border-purple-300 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start">
                <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">WB Sync</p>
                <div class="flex items-center gap-2 mt-1">
                   <div [class]="'w-2 h-2 rounded-full ' + (stats()?.lastSyncStatus === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500')"></div>
                   <p class="text-sm font-bold text-gray-900">{{ stats()?.lastSyncStatus || 'N/A' }}</p>
                </div>
                </div>
                <div class="p-2 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">View sync health →</p>
            </a>
        </div>
      }

      <!-- Dashboard Sync Info Card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100">
          <h2 class="text-lg font-bold text-gray-900">Synchronization Status</h2>
        </div>
        <div class="p-6">
           <div class="flex items-center justify-between">
              <div>
                 <p class="text-sm font-medium text-gray-500">Last Successful Sync</p>
                 <p class="text-lg font-black text-gray-900 mt-1">{{ (stats()?.lastSuccessfulSyncAt | date:'medium') || 'Never' }}</p>
              </div>
              <div class="text-right">
                 <p class="text-sm font-medium text-gray-500">Sync Interval</p>
                 <p class="text-lg font-black text-gray-900 mt-1">{{ stats()?.syncIntervalMinutes }} minutes</p>
              </div>
           </div>
           
           <div class="mt-6 flex items-center justify-between pt-6 border-t border-gray-50">
              <div class="flex items-center gap-2">
                 <div [class]="'w-3 h-3 rounded-full ' + (stats()?.isSyncPaused ? 'bg-yellow-500' : 'bg-green-500')"></div>
                 <span class="text-sm font-bold text-gray-700">{{ stats()?.isSyncPaused ? 'Sync Paused' : 'Sync Active' }}</span>
              </div>
              <a [routerLink]="['/seller/shops', shopId(), 'sync']" class="text-sm font-bold text-purple-600 hover:text-purple-800">Advanced Sync Settings →</a>
           </div>
        </div>
      </div>

      <!-- Quick Nav Links -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <a [routerLink]="['/seller/shops', shopId(), 'products']" class="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl p-5 hover:shadow-md transition-all">
          <p class="font-bold text-purple-900">📦 Manage Products</p>
          <p class="text-sm text-purple-700 mt-1">Edit metadata, pricing & stock</p>
        </a>
        <a [routerLink]="['/seller/shops', shopId(), 'shipments']" class="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-5 hover:shadow-md transition-all">
          <p class="font-bold text-blue-900">🚚 Shipments</p>
          <p class="text-sm text-blue-700 mt-1">Create & update delivery status</p>
        </a>
        <a [routerLink]="['/seller/shops', shopId(), 'settings']" class="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all">
          <p class="font-bold text-gray-900">⚙️ Settings</p>
          <p class="text-sm text-gray-700 mt-1">Shop info & WB integration</p>
        </a>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(SellerDashboardService);
  private context = inject(ShopContextService);

  shop = this.context.currentShop;
  shopId = this.context.currentShopId;
  stats = signal<SellerDashboardStats | null>(null);
  loading = signal(false);

  // automatically reload stats when shopId changes
  private reloadEffect = effect(() => {
    const id = this.shopId();
    if (id) {
       this.loadDashboard(id);
    }
  });

  ngOnInit() {
    // Initial load will be handled by the effect if shopId is present
  }

  loadDashboard(id: string) {
    this.loading.set(true);
    this.dashboardService.getDashboardStats(id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (data) => this.stats.set(data),
      error: () => {}
    });
  }

  getStatusVariant(status: string) {
    switch (status) {
      case 'NEW': return 'gray' as const;
      case 'ASSEMBLING': return 'yellow' as const;
      case 'SHIPPING': return 'purple' as const;
      case 'DELIVERED': return 'green' as const;
      default: return 'red' as const;
    }
  }
}
