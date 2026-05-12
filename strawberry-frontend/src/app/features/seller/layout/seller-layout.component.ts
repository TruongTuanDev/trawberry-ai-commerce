import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { ShopService, Shop } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-seller-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './seller-layout.component.html',
})
export class SellerLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private shopService = inject(ShopService);
  private contextService = inject(ShopContextService);
  private toastService = inject(ToastService);

  shop = this.contextService.currentShop;
  shopId = this.contextService.currentShopId;
  allShops = signal<Shop[]>([]);
  
  sidebarOpen = signal(false);
  switcherOpen = signal(false);

  ngOnInit() {
    this.shopService.getSellerShops().subscribe({
      next: (shops) => this.allShops.set(shops)
    });
  }

  switchShop(id: string) {
    this.switcherOpen.set(false);
    this.shopService.activateShop(id).subscribe({
      next: () => this.contextService.navigateToShop(id, 'dashboard'),
      error: (err) => this.toastService.error(err.error?.message || 'Failed to switch shop'),
    });
  }

  logout() {
    this.authService.logout();
  }
}
