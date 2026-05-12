import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-gray-50 flex">
      <!-- Mobile Backdrop -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 bg-gray-900/60 z-30 lg:hidden backdrop-blur-sm" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <aside 
        class="w-60 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 shrink-0"
        [class.-translate-x-full]="!sidebarOpen()">
        
        <!-- Logo -->
        <div class="px-6 py-6 border-b border-gray-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center">
              <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span class="text-lg font-black tracking-tight">Admin Panel</span>
          </div>
          <button (click)="sidebarOpen.set(false)" class="lg:hidden text-gray-400 hover:text-white">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <a routerLink="/admin/dashboard" (click)="sidebarOpen.set(false)" routerLinkActive="bg-gray-800 text-white"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm font-medium">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Dashboard
          </a>
          <a routerLink="/admin/sellers" (click)="sidebarOpen.set(false)" routerLinkActive="bg-gray-800 text-white"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm font-medium">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Seller Approvals
          </a>
        </nav>

        <!-- User & Logout -->
        <div class="px-4 py-4 border-t border-gray-800 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white uppercase">
              {{ authService.currentUser()?.fullName?.charAt(0) || 'A' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-white truncate">{{ authService.currentUser()?.email }}</p>
              <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Admin</p>
            </div>
            <button (click)="authService.logout()" title="Sign out"
              class="text-gray-400 hover:text-red-400 transition-colors p-1.5 hover:bg-white/5 rounded-lg">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="flex-1 lg:ml-60 flex flex-col min-w-0 max-w-full">
        <!-- Top Header -->
        <header class="bg-white border-b border-gray-200 px-4 sm:px-8 h-16 shrink-0 sticky top-0 z-20 flex items-center">
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-4">
               <button (click)="sidebarOpen.set(true)" class="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                 <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
               </button>
               <h2 class="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] hidden sm:block">Strawberry Marketplace — Admin</h2>
               <h2 class="text-xs text-gray-500 font-bold uppercase tracking-[0.2em] sm:hidden">Admin</h2>
            </div>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-800 border border-red-200 shadow-sm">
              🔒 Secure
            </span>
          </div>
        </header>
        <!-- Page content -->
        <main class="flex-1 p-4 sm:p-8 overflow-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class AdminLayoutComponent {
  authService = inject(AuthService);
  sidebarOpen = signal(false);
}
