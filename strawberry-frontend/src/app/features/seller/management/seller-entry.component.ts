import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ShopService } from '../../../core/services/shop.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-seller-entry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seller-entry.component.html',
  styleUrl: './seller-entry.component.css',
})
export class SellerEntryComponent implements OnInit {
  private shopService = inject(ShopService);
  private router = inject(Router);
  private authService = inject(AuthService);

  isLoading = signal(true);
  approvalStatus = signal<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null);
  reviewNote = signal('');
  shopCount = signal(0);
  sellerName = computed(() => this.authService.currentUser()?.fullName || 'Seller');

  ngOnInit() {
    this.shopService.getSellerWorkspace().subscribe({
      next: (workspace) => {
        this.approvalStatus.set(workspace.approvalStatus);
        this.reviewNote.set(workspace.reviewNote || '');
        this.shopCount.set(workspace.shopCount || 0);

        if (workspace.approvalStatus === 'APPROVED' && workspace.currentShop?.id) {
          this.router.navigate(['/seller/shops', workspace.currentShop.id, 'dashboard']);
          return;
        }

        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  createShop() {
    this.router.navigate(['/seller/shops/create']);
  }
}
