import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ProductResponseDto } from '../models/product-dto.model';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  private base = `${environment.apiUrl}/api/v1/customer/favorites`;

  private _favoriteIds = signal<Set<string>>(new Set());
  private _favoriteProducts = signal<ProductResponseDto[]>([]);
  private _loadingIds = signal(false);
  private _loadingProducts = signal(false);
  private loadedForUserEmail: string | null = null;

  favoriteIds = this._favoriteIds.asReadonly();
  favoriteProducts = this._favoriteProducts.asReadonly();
  loadingProducts = this._loadingProducts.asReadonly();
  favoriteCount = computed(() => this._favoriteIds().size);
  isCustomerLoggedIn = computed(() => {
    const user = this.authService.currentUser();
    return !!user && user.role === 'CUSTOMER' && this.authService.isLoggedIn();
  });

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.role === 'CUSTOMER' && this.authService.isLoggedIn()) {
        if (this.loadedForUserEmail !== user.email) {
          this.loadedForUserEmail = user.email;
          untracked(() => {
            this.loadFavoriteIds().subscribe({ error: () => {} });
          });
        }
      } else {
        this.loadedForUserEmail = null;
        this._favoriteIds.set(new Set());
        this._favoriteProducts.set([]);
      }
    });
  }

  isFavorited(productId: string): boolean {
    return this._favoriteIds().has(productId);
  }

  loadFavoriteIds(): Observable<string[]> {
    if (!this.isCustomerLoggedIn() || this._loadingIds()) {
      return of(Array.from(this._favoriteIds()));
    }

    this._loadingIds.set(true);
    return this.http.get<string[]>(`${this.base}/ids`).pipe(
      tap({
        next: (ids) => this._favoriteIds.set(new Set(ids)),
        error: () => this._favoriteIds.set(new Set()),
      }),
      finalize(() => this._loadingIds.set(false)),
    );
  }

  loadFavorites(): Observable<ProductResponseDto[]> {
    if (!this.isCustomerLoggedIn()) {
      this._favoriteProducts.set([]);
      return of([]);
    }

    this._loadingProducts.set(true);
    return this.http.get<ProductResponseDto[]>(this.base).pipe(
      tap((products) => {
        this._favoriteProducts.set(products);
        this._favoriteIds.set(new Set(products.map((product) => product.id)));
      }),
      finalize(() => this._loadingProducts.set(false)),
    );
  }

  add(productId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${productId}`, {}).pipe(
      tap(() => {
        this._favoriteIds.update((ids) => new Set([...ids, productId]));
      }),
    );
  }

  remove(productId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${productId}`).pipe(
      tap(() => {
        this._favoriteIds.update((ids) => {
          const next = new Set(ids);
          next.delete(productId);
          return next;
        });
        this._favoriteProducts.update((products) => products.filter((product) => product.id !== productId));
      }),
    );
  }

  navigateToLogin(): void {
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url },
    });
  }
}
