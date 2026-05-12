import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { LoadingSpinnerComponent } from '../../../shared/ui/spinner/loading-spinner.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, LoadingSpinnerComponent],
  templateUrl: './cart.component.html',
})
export class CartComponent implements OnInit {
  private cartService = inject(CartService);
  private toast = inject(ToastService);
  private router = inject(Router);

  cart = this.cartService.cart;
  loading = signal(true);

  availableItemCount(): number {
    return this.cart()?.items.filter(item => item.isAvailable).reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  }

  unavailableItemCount(): number {
    return this.cart()?.items.filter(item => !item.isAvailable).length ?? 0;
  }

  formatAttrs(attrs: Record<string, string>) {
    return Object.values(attrs).join(' / ');
  }

  ngOnInit(): void {
    this.cartService.load().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
  }

  updateQty(itemId: string, qty: number): void {
    if (qty < 1) return;
    this.cartService.updateItem(itemId, qty).subscribe({
      error: (err) => this.toast.error(err?.error?.message ?? 'Failed to update')
    });
  }

  remove(itemId: string): void {
    this.cartService.removeItem(itemId).subscribe({
      next: () => this.toast.success('Item removed'),
      error: (err) => this.toast.error(err?.error?.message ?? 'Failed to remove')
    });
  }

  canProceedToCheckout(): boolean {
    const cart = this.cart();
    return !!cart && cart.items.length > 0 && cart.items.every(item => item.isAvailable);
  }

  proceedToCheckout(): void {
    if (!this.canProceedToCheckout()) {
      this.toast.error('Please remove unavailable items before proceeding to checkout.');
      return;
    }

    this.router.navigate(['/checkout']);
  }
}
