import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AdminApiService, PendingSellerDto } from '../../../core/api/admin-api.service';

interface PlatformStats {
  totalProducts?: number;
  totalShops?: number;
  pendingSellers?: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-black text-gray-900 tracking-tight">Admin Dashboard</h1>
        <p class="text-gray-500">Platform overview at a glance.</p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Pending Sellers -->
        <a routerLink="/admin/sellers"
          class="bg-white rounded-2xl shadow-sm border-2 p-6 hover:shadow-md transition-all cursor-pointer"
          [class.border-red-400]="pendingSellers().length > 0"
          [class.border-gray-200]="pendingSellers().length === 0">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Pending Approvals</p>
              <p class="text-4xl font-black mt-1"
                [class.text-red-600]="pendingSellers().length > 0"
                [class.text-gray-900]="pendingSellers().length === 0">
                {{ pendingSellers().length }}
              </p>
            </div>
            <div class="p-3 bg-red-50 rounded-xl">
              <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-3">
            {{ pendingSellers().length > 0 ? 'Action required — review seller queue →' : 'All caught up! No pending reviews.' }}
          </p>
        </a>

        <!-- Placeholder stats cards -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Registered Shops</p>
              <p class="text-4xl font-black text-gray-900 mt-1">—</p>
            </div>
            <div class="p-3 bg-blue-50 rounded-xl">
              <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-3">Platform shop overview (coming soon)</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Products</p>
              <p class="text-4xl font-black text-gray-900 mt-1">—</p>
            </div>
            <div class="p-3 bg-purple-50 rounded-xl">
              <svg class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-3">Catalog size across all shops (coming soon)</p>
        </div>
      </div>

      <!-- Latest Pending Sellers Quick View -->
      @if (pendingSellers().length > 0) {
        <div class="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-red-900">⚠️ Sellers Awaiting Review</h2>
            <a routerLink="/admin/sellers" class="text-sm font-bold text-red-700 hover:text-red-900">
              Review all {{ pendingSellers().length }} →
            </a>
          </div>
          <div class="space-y-2">
            @for (seller of pendingSellers() | slice:0:3; track seller.sellerProfileId) {
              <div class="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-gray-900">{{ seller.fullName }}</p>
                  <p class="text-xs text-gray-500">{{ seller.email }}</p>
                </div>
                <p class="text-xs text-gray-400">{{ seller.createdAt | date:'mediumDate' }}</p>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
          <svg class="h-6 w-6 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm font-medium text-green-900">No pending seller registrations. The queue is clear.</p>
        </div>
      }
    </div>
  `
})
export class AdminDashboardComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  pendingSellers = signal<PendingSellerDto[]>([]);
  loading = signal<boolean>(true);

  ngOnInit() {
    this.adminApi.getPendingSellers().subscribe({
      next: (sellers) => { this.pendingSellers.set(sellers); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
}
