import { Component, Input, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ProductCardVm } from '../../../core/models/product-vm.model';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductCardVm;

  private cartService = inject(CartService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private favoritesService = inject(FavoritesService);
  private authService = inject(AuthService);

  adding = false;
  favoriting = false;

  get discountPct(): number {
    if (!this.product.hasDiscount || !this.product.originalPrice) return 0;
    return Math.round(((this.product.originalPrice - this.product.finalPrice) / this.product.originalPrice) * 100);
  }

  get displayAverageRating(): string {
    return this.product.averageRating > 0 ? this.product.averageRating.toFixed(1) : '0.0';
  }

  get isFavorited(): boolean {
    return this.favoritesService.isFavorited(this.product.id);
  }

  toggleFavorite(e: Event): void {
    e.preventDefault();
    e.stopPropagation();

    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'CUSTOMER') {
      this.favoritesService.navigateToLogin();
      return;
    }

    const wasFavorited = this.isFavorited;
    this.favoriting = true;
    const request = wasFavorited
      ? this.favoritesService.remove(this.product.id)
      : this.favoritesService.add(this.product.id);

    request.subscribe({
      next: () => {
        this.favoriting = false;
        this.toast.success(wasFavorited ? 'Removed from favorites' : 'Added to favorites');
      },
      error: (err) => {
        this.favoriting = false;
        this.toast.error(err?.error?.message ?? 'Failed to update favorites');
      },
    });
  }

  addToCart(e: Event): void {
    e.preventDefault();
    e.stopPropagation();

    if (!this.product.defaultVariantId) {
      this.router.navigate([this.product.productUrl]);
      return;
    }

    this.adding = true;
    this.cartService.addItem(this.product.defaultVariantId, 1).subscribe({
      next: () => {
        this.adding = false;
        this.toast.success(`Added ${this.product.title} to cart`);
      },
      error: (err) => {
        this.adding = false;
        this.toast.error(err?.error?.message ?? 'Failed to add to cart');
      }
    });
  }
}
