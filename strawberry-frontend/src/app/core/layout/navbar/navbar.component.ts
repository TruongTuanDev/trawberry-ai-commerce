import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink, Router, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { FavoritesService } from '../../../core/services/favorites.service';

const NAV_LINKS = [
  { label: 'Home', path: '/', exact: true },
  { label: 'Catalog', path: '/catalog', exact: false },
  { label: 'Brands', path: '/catalog', exact: false },
  { label: 'Deals', path: '/catalog', exact: false },
  { label: 'Delivery', path: '/catalog', exact: false },
  { label: 'About', path: '/', exact: false },
  { label: 'Contact', path: '/', exact: false },
];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, CurrencyPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private favoritesService = inject(FavoritesService);
  private router = inject(Router);

  isLoggedIn = this.authService.isLoggedIn.bind(this.authService);
  currentUser = this.authService.currentUser;
  cartCount = computed(() => this.cartService.cart()?.totalItems ?? 0);
  userInitial = computed(() => {
    const name = this.currentUser()?.fullName ?? '';
    return name ? name.charAt(0).toUpperCase() : '?';
  });
  userFirstName = computed(() => {
    const name = this.currentUser()?.fullName ?? '';
    return name.split(' ')[0] || 'Account';
  });

  isSeller = computed(() => this.currentUser()?.role === 'SELLER');
  isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  isCustomer = computed(() => this.currentUser()?.role === 'CUSTOMER');
  favoriteCount = this.favoritesService.favoriteCount;

  cart = this.cartService.cart;
  cartDrawerOpen = signal(false);

  navLinks = NAV_LINKS;
  searchQuery = '';

  toggleCart(): void {
    this.cartDrawerOpen.set(!this.cartDrawerOpen());
  }

  removeItem(itemId: string): void {
    this.cartService.removeItem(itemId).subscribe();
  }

  onSearch(): void {
    const q = this.searchQuery.trim();
    if (q) {
      this.router.navigate(['/catalog'], { queryParams: { search: q } });
    }
  }

  onCategoryClick(): void {
    this.router.navigate(['/catalog']);
  }

  onMenuClick(): void {
    this.router.navigate(['/catalog']);
  }

  openFavorites(): void {
    this.router.navigate(['/favorites']);
  }

  logout(): void {
    this.authService.logout();
  }
}
